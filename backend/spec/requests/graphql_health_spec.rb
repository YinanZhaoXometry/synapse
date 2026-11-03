# frozen_string_literal: true

require "rails_helper"

RSpec.describe "GraphQL health query", type: :request do
  it "answers ok" do
    post "/graphql", params: { query: "{ health }" }

    expect(response).to have_http_status(:ok)
    expect(JSON.parse(response.body)).to eq("data" => { "health" => "ok" })
  end
end
