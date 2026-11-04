# Production image for the Synapse api (AD-20: api → Render docker service).
# Built ONLY by the Render blueprint (render.yaml at the repo root: context
# ./backend, dockerfilePath ./backend/Dockerfile) — local dev keeps riding
# .dockerdev/Dockerfile.dev (volume-mounted workspace + bundle-cache volume,
# neither of which exists on Render, which is why this image is self-contained
# and bakes the gems in).
#
# Same base as the dev image (backend/.ruby-version = 3.4.12; AD-13 local/prod
# parity for the runtime). API-only Rails: no asset precompilation step exists
# to run. The boot command runs the (idempotent) db:prepare + demo seed before
# exec'ing puma — see the CMD comment for why the seed rides every boot (AD-15).
FROM ruby:3.4.12-slim

ENV LANG=C.UTF-8 \
    BUNDLE_JOBS=4 \
    BUNDLE_RETRY=3 \
    RAILS_ENV=production \
    RAILS_LOG_LEVEL=info

# Same apt set as .dockerdev/Dockerfile.dev (proven sufficient to bundle this
# Gemfile: pg needs libpq-dev, bcrypt builds under build-essential); curl and
# git are carried over for in-container debugging/bundle parity.
RUN apt-get update -qq \
  && apt-get install -y --no-install-recommends \
       build-essential \
       curl \
       git \
       libpq-dev \
       pkg-config \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Gemfiles first so the dependency layer caches independently of app code.
COPY Gemfile Gemfile.lock ./
# Production gems only (rspec/factory_bot/rubocop stay out of the image).
RUN bundle config set --local without "development test" \
  && bundle install \
  && rm -rf /app/vendor/bundle

COPY . .

# One process (AD-19/AD-20): puma boots the Solid Queue supervisor in-process
# when SOLID_QUEUE_IN_PUMA is set (config/puma.rb) — render.yaml sets it; there
# is NO worker service. puma.rb binds ENV["PORT"] (Render injects it) and
# reads RAILS_MAX_THREADS/WEB_CONCURRENCY when present (leave unset: the
# shipped defaults give the exact AR-pool arithmetic — docs/deploy.md).
#
# db:prepare migrates an existing database (or creates+loads a fresh one) and
# db:seed runs the idempotent DemoSeed (AD-15): stable-uuid upserts, rerun-safe
# on every boot, so the demo account survives database re-provisions and
# deploys alike. The seed fails fast in production when DEMO_EMAIL/DEMO_PASSWORD
# are absent/blank (app/lib/demo_seed.rb) — a named boot error beats invented
# credentials. Running both on every cold start is a handful of idempotent
# statements; correctness (schema current + demo account present) beats the
# ~seconds of wake latency on the accepted free-tier cold start (AD-20).
CMD ["sh", "-c", "bundle exec rails db:prepare db:seed && exec bundle exec puma -C config/puma.rb"]
