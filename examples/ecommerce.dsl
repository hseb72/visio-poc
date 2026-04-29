diagram "E-commerce Architecture" {

  // Front
  component web as "Web Frontend" {
    tech: "React"
    description: "SPA cliente"
  }

  // API
  component gateway as "API Gateway" {
    tech: "Kong"
  }

  // Services métier
  service auth as "Auth Service" {
    tech: "Node.js"
  }

  service catalog as "Catalog Service" {
    tech: "Go"
  }

  service orders as "Orders Service" {
    tech: "Java"
  }

  // Données
  database userdb as "User DB" {
    tech: "PostgreSQL"
  }

  database catalogdb as "Catalog DB" {
    tech: "MongoDB"
  }

  // Messaging
  queue events as "Event Bus" {
    tech: "Kafka"
  }

  // Externe
  external stripe as "Stripe API"
  external sendgrid as "SendGrid"

  // Groupes
  group backend as "Backend Services" {
    contains: auth, catalog, orders
  }

  group data as "Data Layer" {
    contains: userdb, catalogdb
  }

  // Relations
  web -> gateway: "HTTPS"
  gateway -> auth: "valide JWT"
  gateway -> catalog: "lit"
  gateway -> orders: "écrit"

  auth -> userdb: "lit/écrit"
  catalog -> catalogdb: "lit/écrit"
  orders -> events: "publie"
  orders ..> stripe: "paiement"
  orders ..> sendgrid: "email confirmation"
}
