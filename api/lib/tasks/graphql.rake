# frozen_string_literal: true

# Dump the api's GraphQL contract (AD-17): the committed IDL at
# api/schema.graphql is the only cross-stack artifact — web's graphql-codegen
# consumes it. IDL only: graphql-ruby 2.5's introspection-JSON dump is broken
# against the json gem 3.x bundled with Ruby 3.4 (quirks_mode), and the web
# contract only needs the IDL.
namespace :graphql do
  namespace :schema do
    desc "Dump the api schema IDL into schema.graphql (the committed contract)"
    task dump: :environment do
      out_path = Rails.root.join("schema.graphql")
      definition = ApiSchema.to_definition
      definition += "\n" unless definition.end_with?("\n")
      File.write(out_path, definition)
      puts "Schema IDL dumped into #{out_path}"
    end
  end
end
