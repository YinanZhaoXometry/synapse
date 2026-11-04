# frozen_string_literal: true

namespace :ai do
  desc "One live provider probe (S6 pattern) — manual, never in CI"
  task probe: :environment do
    config = Ai::Provider.configuration
    abort "ai:probe — PROVIDER_KEY is blank; set it first (see backend/.env.example)" if config[:api_key].blank?

    puts "probing #{config[:base_url]} model=#{config[:model]} …"
    client = Ai::GlmClient.new(**config)
    reply = client.complete([
      { role: "system", content: "You are a connectivity probe. Reply with exactly the requested token and nothing else." },
      { role: "user", content: "Reply with exactly: synapse-probe-ok" }
    ])
    puts "model replied (#{reply.length} chars): #{reply.strip[0, 200]}"

    if reply.include?("synapse-probe-ok")
      puts "ai:probe OK"
    else
      abort "ai:probe FAILED — unexpected reply (transport worked, model misbehaved)"
    end
  rescue Ai::ProviderError => e
    abort "ai:probe FAILED — #{e.message}"
  end
end
