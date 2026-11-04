# frozen_string_literal: true

require "rails_helper"

# AD-13 (epic P2-6 ticket 01): the ActiveStorage direct-uploads REST surface is
# never mounted — uploads presign through GraphQL (`createMaterialUpload`,
# ticket 02) and the browser PUTs to R2/minio directly; presigned URLs point at
# the storage provider, never at the backend (backend/AGENTS.md, "GraphQL is
# the only web-facing surface"). `config.active_storage.draw_routes = false`
# (config/application.rb) keeps the engine's routes out of the table, and this
# route-table spec is the guard — ticket 02 re-asserts alongside its presign
# flow.
RSpec.describe "ActiveStorage routes are never mounted", type: :routing do
  it "draws no /rails/active_storage route" do
    mounted = Rails.application.routes.routes.select do |route|
      route.defaults[:controller].to_s.start_with?("active_storage/")
    end

    expect(mounted.map { |route| route.defaults[:controller] }).to be_empty
  end

  it "leaves the health check as the only rails_-prefixed named route" do
    rails_named = Rails.application.routes.named_routes.names
                        .select { |name| name.to_s.start_with?("rails_") }

    # ActiveStorage would add rails_service_blob / rails_blob /
    # rails_representation / rails_disk_service / rails_direct_uploads (+_redirect
    # variants) if its routes were ever drawn.
    expect(rails_named).to contain_exactly(:rails_health_check)
  end

  it "does not respond with the ActiveStorage blob url helpers" do
    expect(Rails.application.routes.url_helpers).not_to respond_to(:rails_blob_url)
    expect(Rails.application.routes.url_helpers).not_to respond_to(:rails_service_blob_url)
  end

  it "leaves the classic blob URL unroutable" do
    expect(
      get: "/rails/active_storage/blobs/redirect/00000000-0000-0000-0000-000000000000/synapse.txt"
    ).not_to be_routable
  end
end
