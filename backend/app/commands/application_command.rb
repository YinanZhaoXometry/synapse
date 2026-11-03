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
# - Every Failure carries a closed-enum code (ApplicationErrors::CODES), and
#   the `Failure` factory below is the only way to build one.
#
# Pattern exemplar: System::PingCommand (spec/commands/system/ping_command_spec.rb).
class ApplicationCommand
  extend Dry::Initializer
  include Dry::Monads[:result]

  class << self
    # Entry point: build the command from dry-initializer inputs, run the
    # authorize hook, then call. Returns a dry-monads Result; never raises.
    def call(**args)
      command = new(**args)
      command.authorize.bind { command.call }
    end
  end

  # Overridable authorization hook; default allows. Return a Result —
  # deny with `Failure(:UNAUTHORIZED, ...)`.
  def authorize
    Success()
  end

  private

  # Failure factory: the only sanctioned way to build a failure inside a
  # command. Wraps a closed-enum code + free-form context into the typed
  # value object (ApplicationErrors::Failure).
  #
  # rubocop:disable Naming/MethodName -- mirrors dry-monads' capitalized factories
  def Failure(code, context = {})
    Dry::Monads::Failure.new(ApplicationErrors::Failure.new(code: code, context: context))
  end
  # rubocop:enable Naming/MethodName
end
