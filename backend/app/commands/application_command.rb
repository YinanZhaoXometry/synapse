# frozen_string_literal: true

require "dry-initializer"
require "dry/monads"

# The command-layer base class (AD-12): every use case is an
# ApplicationCommand subclass. Resolvers/mutations parse args → authorize →
# call the command → map the Result; jobs are thin wrappers around commands.
#
# Contract:
# - Inputs are declared as dry-initializer `option`s (inherited from here).
# - `#authorize` — overridable hook, returns a Result; deny with
#   `Failure(:UNAUTHORIZED, ...)`. Default: allow.
# - `#call` — the work; must return a dry-monads Result.
# - Commands never raise: `.call` converts any unexpected StandardError from
#   authorize/call into a typed INTERNAL failure. Failures are values, not
#   exceptions — domain outcomes must always be `Failure(code, context)`.
#   The deliberate exceptions (infrastructure misuse fails fast at the seam):
#   ApplicationErrors::InvalidCodeError re-raises, and construction misuse —
#   an exception from `new(**args)` itself (e.g. a raising dry-initializer
#   `default:` proc) — raises out of `.call` instead of being swallowed into
#   INTERNAL (the instance is built before the rescue region; see `run`).
# - Every Failure carries a closed-enum code (ApplicationErrors::CODES), and
#   the `Failure` factory below is the only way to build one.
#
# Pattern exemplar: System::PingCommand (spec/commands/system/ping_command_spec.rb).
class ApplicationCommand
  extend Dry::Initializer
  include Dry::Monads[:result]

  class << self
    # Entry point: build the command from dry-initializer inputs, run the
    # authorize hook, then call. Returns a dry-monads Result; never raises —
    # unexpected exceptions from authorize/call become typed INTERNAL
    # failures (the exception class + message ride along as log context).
    # The one deliberate exception: ApplicationErrors::InvalidCodeError
    # re-raises (infrastructure misuse fails fast at the seam).
    #
    # Construction happens BEFORE the rescue region on purpose: a method-level
    # rescue covers its whole body, so `new(**args)` is delegated to a private
    # method that runs `.call` with no rescue of its own. A raising
    # dry-initializer `default:` proc (or any other construction misuse) is a
    # programmer error at the seam — it propagates out of `.call` instead of
    # masquerading as a domain INTERNAL failure. Only authorize/call run under
    # the never-raise rescue (in `run`).
    def call(**args)
      run(new(**args))
    end

    private

    # The rescue region: authorize + call only. A Failure built with a code
    # outside the closed enum re-raises (ApplicationErrors::InvalidCodeError),
    # and any other StandardError becomes a typed INTERNAL failure.
    def run(command)
      command.authorize.bind { command.call }
    rescue ApplicationErrors::InvalidCodeError
      raise
    rescue StandardError => e
      Dry::Monads::Failure.new(
        ApplicationErrors::Failure.new(
          code: :INTERNAL,
          context: { message: "unexpected #{e.class.name}: #{e.message}" }
        )
      )
    end
  end

  # Overridable authorization hook; default allows. Return a Result —
  # deny with `Failure(:UNAUTHORIZED, ...)`.
  def authorize
    Success()
  end

  private

  # Failure factory: the only sanctioned way to build a failure inside a
  # command. The code MUST be one of ApplicationErrors::CODES — anything else
  # raises ApplicationErrors::InvalidCodeError (an ArgumentError): that is
  # infrastructure misuse, not a domain outcome, so it fails fast instead of
  # masquerading as a Failure.
  #
  # rubocop:disable Naming/MethodName -- mirrors dry-monads' capitalized factories
  def Failure(code, context = {})
    unless ApplicationErrors::CODES.include?(code)
      raise ApplicationErrors::InvalidCodeError,
            "#{code.inspect} is not a closed-enum error code " \
            "(#{ApplicationErrors::CODES.map(&:inspect).join(', ')})"
    end

    Dry::Monads::Failure.new(ApplicationErrors::Failure.new(code: code, context: context))
  end
  # rubocop:enable Naming/MethodName
end
