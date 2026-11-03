# frozen_string_literal: true

# AD-13 / FR-4's standing test: one authenticated user cannot list or fetch
# another user's rows by id. These shared examples ARE the scoping contract —
# every user-owned model must satisfy them.
#
# The aggregate roster spec (spec/models/user_scoping_spec.rb) discovers every
# concrete model dynamically and runs these examples for each, so a new model
# is covered without touching this file. A model spec may also include them
# directly (one include away for later epics):
#
#   include_examples "user-scoped", described_class
#
# A second argument overrides the User has_many name when it cannot be derived
# (default: model.name.underscore.pluralize):
#
#   include_examples "user-scoped", described_class, :memberships
RSpec.shared_examples "user-scoped" do |model, user_assoc_name = nil|
  user_assoc_name ||= model.name.underscore.pluralize
  factory_name = model.name.underscore.to_sym

  let(:user) { create(:user) }
  let(:other_user) { create(:user) }
  let(:own_record) { create(factory_name, user: user) }
  let(:foreign_record) { create(factory_name, user: other_user) }

  it "lists only the owner's rows through User##{user_assoc_name}" do
    own_record
    foreign_record

    expect(user.public_send(user_assoc_name).to_a).to eq([ own_record ])
  end

  it "does not find another user's row by id through the scope (find_by → nil)" do
    own_record
    foreign_record

    expect(user.public_send(user_assoc_name).find_by(id: foreign_record.id)).to be_nil
  end

  it "raises ActiveRecord::RecordNotFound fetching another user's row by id (.find)" do
    foreign_record

    expect { user.public_send(user_assoc_name).find(foreign_record.id) }
      .to raise_error(ActiveRecord::RecordNotFound)
  end

  it "reads a same-user row by id through the scope" do
    own_record

    expect(user.public_send(user_assoc_name).find(own_record.id)).to eq(own_record)
  end
end
