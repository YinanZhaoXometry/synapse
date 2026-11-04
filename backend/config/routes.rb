Rails.application.routes.draw do
  post "/graphql", to: "graphql#execute"
  # The ONE non-GraphQL api surface (AD-16, epic P2-5 ticket 04): SSE token
  # streams, authenticated by single-use stream tickets alone — minted by
  # the createStreamTicket mutation. A route-absence spec guards the
  # ActiveStorage direct-uploads surface (see config/application.rb); this
  # route's contract (401 on any bad ticket, event vocabulary) is pinned by
  # spec/requests/api_stream_spec.rb.
  get "/api/stream", to: "api/stream#show"

  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check
end
