# Pistachio

**Pistachio** is an Object-Oriented Hypermedia Framework for JavaScript.

Rather than treating HTTP as a collection of controllers, Pistachio exposes object graphs directly as navigable resource topologies. Resources, relationships, and behaviors are described declaratively, then compiled into executable HTTP routes.

The result is an API that reflects the structure of the domain itself.

---

## Philosophy

Most web frameworks begin with HTTP.

Routes are declared, controllers are attached, and the application is written to satisfy those endpoints.

Pistachio begins somewhere else.

The application is a graph of objects connected through relationships. HTTP is simply one representation of that graph.

A resource is not a controller.

A relationship is not just another URL.

A procedure is not an RPC endpoint.

Each exists because it exists in the domain.

Pistachio's job is simply to project that domain onto the web.

---

## Core Concepts

Pistachio models every API in terms of four concepts.

### Resources

Resources are domain objects exposed over HTTP.

A resource may support conventional CRUD operations, executable behaviors, or both.

```text
Feed
User
Invoice
Order
```

---

### Relations

Resources expose relationships to other resources.

Relationships become navigable URLs without requiring manual route construction.

```text
Feed
 └── subscriptions
      └── subscription
```

becomes

```text
/feeds/:id/subscriptions
/feeds/:id/subscriptions/:subId
```

---

### Procedures

Not every domain behavior is CRUD.

Pistachio allows arbitrary object methods to be exposed as HTTP operations.

```text
PUT /feeds/:id/subscriptions
DELETE /feeds/:id/subscriptions/:subId
```

These invoke methods on the underlying domain model rather than introducing controller logic.

---

### Views

Resources are independent of representation.

Views render domain objects into negotiated media types.

```text
application/json
text/html
application/vnd.example+json
```

The domain remains unaware of HTTP serialization.

---

## Object-Oriented Hypermedia

Pistachio treats URLs as navigable object references.

Given a domain model

```text
Feed
 └── SubscriptionCollection
      └── Subscription
```

Pistachio compiles the topology into executable routes.

```text
GET    /feeds
POST   /feeds

GET    /feeds/:id

GET    /feeds/:id/subscriptions
PUT    /feeds/:id/subscriptions

GET    /feeds/:id/subscriptions/:subId
DELETE /feeds/:id/subscriptions/:subId
```

No controllers.

No duplicated routing logic.

The topology already exists inside the object model.

---

## Resource Metadata

Resources describe their HTTP topology declaratively.

```javascript
static HTTP = {
  allowedMethods: ['GET', 'POST'],

  rel: {
    subscriptions: {
      accessor: 'subscriptions',

      proc: {
        add: {
          method: 'PUT'
        },

        remove: {
          method: 'DELETE',
          instance: true
        }
      }
    }
  }
}
```

Pistachio compiles this metadata into executable routes during application startup.

---

## Execution Model

Every request follows the same lifecycle.

```text
HTTP Request
      │
      ▼
Route Resolution
      │
      ▼
Middleware Pipeline
      │
      ▼
ResourceOperation
      │
      ├── resolve root
      ├── resolve relation
      ├── resolve instance
      └── execute procedure
      │
      ▼
View Rendering
      │
      ▼
HTTP Response
```

The routing layer remains thin.

Domain execution occurs inside a `ResourceOperation`, which encapsulates the state and behavior of a single request.

---

## Design Goals

Pistachio is designed around a small number of principles.

- Object-oriented first
- Hypermedia by construction
- Declarative resource topology
- Explicit domain behavior
- Representation independence
- Minimal framework magic
- No controller layer
- Separation of HTTP, domain, and persistence concerns

---

## Architecture

Pistachio intentionally separates three independent models.

```text
             HTTP Model
                  │
          ResourceOperation
                  │
        Domain Object Model
                  │
          Persistence Layer
```

The domain has no knowledge of HTTP.

Persistence has no knowledge of routing.

HTTP simply projects the object graph.

---

## Why Pistachio?

Traditional frameworks ask:

> "What controller handles this request?"

Pistachio asks:

> "What object does this URL represent?"

Once that object is identified, everything else follows naturally.

Relations become navigation.

Methods become procedures.

Representations become views.

The API becomes a faithful projection of the domain rather than an independent layer that must be kept in sync.