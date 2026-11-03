# frozen_string_literal: true

require "rails_helper"
require "rake"

RSpec.describe "GraphQL schema contract", type: :task do
  before do
    Rails.application.load_tasks
  end

  it "re-dumps byte-identical to the committed backend/schema.graphql" do
    committed = Rails.root.join("schema.graphql").read

    dump_task = Rake::Task["graphql:schema:dump"]
    2.times do
      dump_task.reenable
      dump_task.invoke
    end

    expect(Rails.root.join("schema.graphql").read).to eq(committed)
  end
end
