# frozen_string_literal: true

require "rails_helper"
require "socket"

# Ai::GlmClient against a local stub HTTP server (ticket 01's "stub-able in
# tests, no live calls in CI"). The stub is stdlib TCPServer — no WebMock in
# the tree (kickoff delta 3: zero new deps) — and it hands back raw canned
# bytes, so the specs exercise the real Net::HTTP path: request building,
# Connection: close-delimited streaming, chunk fragmentation, and the
# ProviderError mappings.
RSpec.describe Ai::GlmClient do
  # Serves ONE canned response to every connection; writes `parts`
  # sequentially (with a breath between them, when fragmentation matters).
  class StubHttpServer
    attr_reader :requests

    def initialize(parts, inter_part_delay: 0.0)
      @parts = parts
      @inter_part_delay = inter_part_delay
      @requests = []
      @tcp = TCPServer.new("127.0.0.1", 0)
      @thread = Thread.new { accept_loop }
    end

    def base_url
      "http://127.0.0.1:#{port}/v4"
    end

    def port
      @tcp.addr[1]
    end

    def stop
      @tcp.close
      @thread.join(1)
    rescue IOError
      nil
    end

    private

    def accept_loop
      loop do
        socket = @tcp.accept
        requests << read_request(socket)
        @parts.each do |part|
          sleep(@inter_part_delay) unless part.equal?(@parts.first) || @inter_part_delay.zero?
          socket.write(part)
        end
        socket.close
      end
    rescue IOError, Errno::EBADF, Errno::EPIPE
      nil
    end

    def read_request(socket)
      head = +""
      until head.include?("\r\n\r\n")
        head << socket.readpartial(4096)
      end
      head_part, remainder = head.split("\r\n\r\n", 2)
      content_length = head_part[/Content-Length: (\d+)/i, 1].to_i
      body = remainder.to_s
      body << socket.readpartial(4096) while body.length < content_length
      { head: head_part, body: body }
    end
  end

  def http_ok(body, content_type: "application/json")
    "HTTP/1.1 200 OK\r\nContent-Type: #{content_type}\r\nConnection: close\r\n\r\n#{body}"
  end

  def client(server)
    described_class.new(base_url: server.base_url, api_key: "test-key", model: "test-model", timeout_seconds: 5)
  end

  def messages
    [ { role: "user", content: "hello" } ]
  end

  after { @server&.stop }

  describe ".complete" do
    it "POSTs the OpenAI-compatible request shape and returns the assistant content" do
      @server = StubHttpServer.new([ http_ok({ choices: [ { message: { content: "raw reply" } } ] }.to_json) ])
      subject = client(@server)

      expect(subject.complete(messages)).to eq("raw reply")

      request = @server.requests.first
      expect(request[:head]).to include("POST /v4/chat/completions")
      expect(request[:head]).to include("Authorization: Bearer test-key")
      expect(request[:head]).to include("Content-Type: application/json")
      body = JSON.parse(request[:body])
      expect(body).to include("model" => "test-model", "stream" => false)
      expect(body["messages"]).to eq([ { "role" => "user", "content" => "hello" } ])
    end

    it "raises ProviderError on a non-200 status" do
      @server = StubHttpServer.new([ "HTTP/1.1 401 Unauthorized\r\nContent-Length: 0\r\n\r\n" ])
      expect { client(@server).complete(messages) }.to raise_error(Ai::ProviderError, /HTTP 401/)
    end

    it "raises ProviderError when the completion body carries an error object" do
      @server = StubHttpServer.new([ http_ok({ error: { message: "quota" } }.to_json) ])
      expect { client(@server).complete(messages) }.to raise_error(Ai::ProviderError, /provider error payload/)
    end

    it "raises ProviderError when the completion body is not provider-shaped JSON" do
      @server = StubHttpServer.new([ http_ok("not json at all") ])
      expect { client(@server).complete(messages) }.to raise_error(Ai::ProviderError)
    end
  end

  describe ".stream" do
    it "yields the content deltas in order and stops after [DONE]" do
      sse = [
        sse_data({ choices: [ { delta: { role: "assistant" } } ] }), # no content — not a token
        sse_data({ choices: [ { delta: { content: "Hel" } } ] }),
        sse_data({ choices: [ { delta: { content: "lo" } } ] }),
        sse_data("[DONE]")
      ].join
      @server = StubHttpServer.new([ http_ok(sse, content_type: "text/event-stream") ])

      expect(client(@server).stream(messages).to_a).to eq(%w[Hel lo])
      body = JSON.parse(@server.requests.first[:body])
      expect(body).to include("stream" => true)
    end

    it "reassembles deltas across fragmented TCP chunks" do
      # The same logical stream, delivered in two writes with a delay — the
      # second write starts mid-JSON-object.
      whole = sse_data({ choices: [ { delta: { content: "完整的句子" } } ] })
      split_at = whole.index("{\"choices") + 20
      @server = StubHttpServer.new(
        [ http_ok(whole[0...split_at], content_type: "text/event-stream"), whole[split_at..] ],
        inter_part_delay: 0.05
      )

      expect(client(@server).stream(messages).to_a).to eq([ "完整的句子" ])
    end

    it "raises ProviderError when an error payload surfaces mid-stream" do
      sse = sse_data({ choices: [ { delta: { content: "so far so good" } } ] }) +
            sse_data({ error: { message: "overloaded" } })
      @server = StubHttpServer.new([ http_ok(sse, content_type: "text/event-stream") ])

      enumerator = client(@server).stream(messages)
      expect(enumerator.next).to eq("so far so good")
      expect { enumerator.next }.to raise_error(Ai::ProviderError, /provider stream error payload/)
    end

    it "skips unparseable data lines instead of corrupting the token stream" do
      sse = [
        sse_data("{not json"),
        sse_data({ choices: [ { delta: { content: "still here" } } ] })
      ].join
      @server = StubHttpServer.new([ http_ok(sse, content_type: "text/event-stream") ])

      expect(client(@server).stream(messages).to_a).to eq([ "still here" ])
    end

    it "maps a pull-time read timeout (hung server) to ProviderError" do
      # A server that accepts and never answers: Net::ReadTimeout fires at
      # first pull — inside the Enumerator block, so the typed contract
      # holds (the epic review's dead-rescue finding).
      tcp = TCPServer.new("127.0.0.1", 0)
      accept_thread = Thread.new do
        # Accept and hold the connection open without ever answering. The
        # loop EXITS on the ensure's close (a rescue-continue here would
        # spin forever after close and hang the spec process at exit —
        # non-daemon threads block termination).
        Thread.new(tcp.accept) { |s| sleep 10 rescue nil }
      rescue IOError, Errno::EBADF
        nil
      end
      hung = described_class.new(
        base_url: "http://127.0.0.1:#{tcp.addr[1]}/v4",
        api_key: "test-key", model: "test-model", timeout_seconds: 1
      )
      begin
        expect { hung.stream(messages).next }.to raise_error(Ai::ProviderError, /transport failure/)
      ensure
        tcp.close
        accept_thread.join(1) rescue nil
      end
    end

    it "raises ProviderError lazily for a non-200 status — at first pull" do
      @server = StubHttpServer.new([ "HTTP/1.1 500 Internal Server Error\r\nContent-Length: 0\r\n\r\n" ])

      enumerator = client(@server).stream(messages)
      expect { enumerator.next }.to raise_error(Ai::ProviderError, /HTTP 500/)
    end
  end

  private

  def sse_data(payload)
    payload = payload.to_json unless payload.is_a?(String)
    "data: #{payload}\n\n"
  end
end
