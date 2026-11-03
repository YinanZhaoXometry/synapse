# frozen_string_literal: true

# Maps a command-layer failure into the GraphQL error payload (AD-12):
#
#   { message: "...", extensions: { code: "NOT_FOUND" } }
#
# Input: the unwrapped failure value (`result.failure`, an
# ApplicationErrors::Failure). Output: a plain hash — resolvers/mutations
# feed it to
# `GraphQL::ExecutionError.new(payload[:message], extensions: payload[:extensions])`.
#
# `extensions.code` is the closed enum (ApplicationErrors::CODES) mirrored
# 1:1 by the web's AppError.code. The api is not user-facing (AD-9):
# `message` is an English log line — the failure context's `:message` when
# present, else the code itself — and the rest of the context is deliberately
# NOT copied into the payload.
class ErrorPresenter
  def self.call(failure)
    code = failure.code.to_s

    {
      message: failure.context[:message] || code,
      extensions: { code: code }
    }
  end
end
