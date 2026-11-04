require "active_support/core_ext/integer/time"

Rails.application.configure do
  # Settings specified here will take precedence over those in config/application.rb.

  # Code is not reloaded between requests.
  config.enable_reloading = false

  # Eager load code on boot for better performance and memory savings (ignored by Rake tasks).
  config.eager_load = true

  # Full error reports are disabled.
  config.consider_all_requests_local = false

  # Cache assets for far-future expiry since they are all digest stamped.
  config.public_file_server.headers = { "cache-control" => "public, max-age=#{1.year.to_i}" }

  # Enable serving of images, stylesheets, and JavaScripts from an asset server.
  # config.asset_host = "http://assets.example.com"

  # Assume all access to the app is happening through a SSL-terminating reverse proxy.
  config.assume_ssl = true

  # Force all access to the app over SSL, use Strict-Transport-Security, and use secure cookies.
  config.force_ssl = true

  # Skip http-to-https redirect for the default health check endpoint.
  # config.ssl_options = { redirect: { exclude: ->(request) { request.path == "/up" } } }

  # Log to STDOUT with the current request id as a default log tag.
  config.log_tags = [ :request_id ]
  config.logger   = ActiveSupport::TaggedLogging.logger(STDOUT)

  # Change to "debug" to log everything (including potentially personally-identifiable information!).
  config.log_level = ENV.fetch("RAILS_LOG_LEVEL", "info")

  # Prevent health checks from clogging up the logs.
  config.silence_healthcheck_path = "/up"

  # Don't log any deprecations.
  config.active_support.report_deprecations = false

  # Replace the default in-process memory cache store with a durable alternative.
  # config.cache_store = :mem_cache_store

  # Replace the default in-process and non-durable queuing backend for Active Job.
  # Solid Queue in-process with puma (AD-19, epic P2-7 ticket 01); the queue
  # tables live in the SAME Postgres via DATABASE_URL (kickoff decision 4 —
  # no connects_to split): point that URL at Neon's DIRECT (non-pooled)
  # endpoint in production, Solid Queue's polling dislikes transaction-mode
  # pooling. The supervisor boots from config/queue.yml +
  # config/recurring.yml via the puma plugin (config/puma.rb).
  config.active_job.queue_adapter = :solid_queue

  # Enable locale fallbacks for I18n (makes lookups for any locale fall back to
  # the I18n.default_locale when a translation cannot be found).
  config.i18n.fallbacks = true

  # Do not dump schema after migrations.
  config.active_record.dump_schema_after_migration = false

  # Only use :id for inspections in production.
  config.active_record.attributes_for_inspect = [ :id ]

  # Enable DNS rebinding protection and other `Host` header attacks.
  # config.hosts = [
  #   "example.com",     # Allow requests from example.com
  #   /.*\.example\.com/ # Allow requests from subdomains like `www.example.com`
  # ]
  #
  # Skip DNS rebinding protection for the default health check endpoint.
  # config.host_authorization = { exclude: ->(request) { request.path == "/up" } }

  # Object storage (AD-13, epic P2-6 ticket 01): Cloudflare R2 — the :r2
  # service in backend/config/storage.yml reads every value from ENV with no
  # defaults, so fail fast at boot when the contract is incomplete instead of
  # silently pointing the S3 client at a wrong (or AWS-default) endpoint.
  config.active_storage.service = :r2
  %w[R2_ENDPOINT R2_BUCKET R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY].each do |key|
    if ENV[key].blank?
      raise "Missing #{key} — the :r2 ActiveStorage service requires all four " \
            "R2_* ENV vars in production (backend/.env.example)"
    end
  end

  # AI provider (AD-16, epic P2-5 ticket 02): server-side AI is a production
  # surface from the web cutover (epic P2-8) — fail fast at boot instead of
  # answering every AI call with INTERNAL. Cap values stay optional with
  # defaults (Ai::DailyCap), matching the login rate-limit posture.
  if ENV["PROVIDER_KEY"].blank?
    raise "Missing PROVIDER_KEY — the Ai::Provider seam requires it in " \
          "production (AD-16, backend/.env.example)"
  end
end
