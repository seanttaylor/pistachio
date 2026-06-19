# Pistachio

> A resource-oriented HTTP router for JavaScript and Deno.

Pistachio is an HTTP router built around a simple idea:

> **Resources should describe themselves.**

Rather than imperatively wiring HTTP endpoints to controller functions, resources declare how they are exposed over HTTP. From that description, Pistachio compiles an internal routing model capable of resolving requests, executing middleware, invoking domain operations, persisting state, and rendering representations.

The result is significantly less routing boilerplate and a clearer separation between domain logic, persistence, transport, and presentation.

> **Status:** Early development (v0.x). APIs may change as the resource model continues to evolve.

---

# Motivation

Traditional HTTP frameworks often encourage routing code like this:

```js
router.get("/feeds", controller.list);
router.post("/feeds", controller.create);
router.get("/feeds/:id", controller.read);
router.put("/feeds/:id", controller.update);
router.delete("/feeds/:id", controller.remove);
```

As applications grow, routing becomes another layer that must be maintained independently from the resources themselves.

A developer creates a service...

...then creates a controller...

...then wires routes...

...then configures middleware...

...then decides how responses should be serialized.

Much of this is plumbing.

Pistachio instead treats the resource itself as the source of truth.

---

# Philosophy

Pistachio is built around several guiding principles.

## Resources describe themselves

Resources define how they are exposed over HTTP through a static `HTTP` description.

```js
class Feed {
  static HTTP = {
    subscribe: {
      method: "POST",
      path: "/subscriptions",
      rel: "create",
    },

    archive: {
      method: "DELETE",
      path: "",
      rel: "update",
    },
  };
}
```

This description is compiled into a routing table during application startup.

---

## Domain operations are not CRUD operations

A resource may expose operations such as

* subscribe
* archive
* publish
* approve

These are domain operations.

They are **related** to persistence through the `rel` property, but they are not themselves CRUD operations.

For example,

```text
POST /feeds/:id/subscriptions
```

invokes

```js
feed.subscribe(...)
```

while

```text
rel: "create"
```

instructs Pistachio to persist the resulting resource using the resource's persistence implementation.

This keeps domain behavior independent of storage.

---

## Persistence is abstract

Resources do not know how data is stored.

Instead they receive a persistence implementation.

```js
new Feed(
    new MemoryFeedWriter()
)
```

Today this might be an in-memory implementation.

Tomorrow it might target PostgreSQL, MongoDB, Redis, DynamoDB, or a remote API.

The resource itself never changes.

---

## Resources can have multiple representations

A resource is independent from how it is represented.

The same resource may be rendered as

* JSON
* HTML
* CSV
* PDF
* XML

using interchangeable resource views.

```js
router.resource("/feeds", feed, {
    views: [
        new FeedViewJSON(),
        new FeedViewHTML(),
        new FeedViewCSV(),
    ]
});
```

Pistachio performs content negotiation and delegates response generation to the selected view.

---

## Middleware remains simple

Middleware receives a request context and a `next()` function.

```js
export async function logger(ctx, next) {
    const start = Date.now();

    const response = await next();

    console.log(Date.now() - start);

    return response;
}
```

Middleware may

* continue execution
* modify the request
* modify the response
* terminate the request early

by simply returning a `Response`.

---

# Example

```js
const router = new Pistachio();

router.resource(
    "/feeds",
    new Feed(
        new MemoryFeedWriter()
    ),
    {
        collection: true,

        allowedMethods: [
            "GET",
            "POST",
        ],

        use: [
            logger,
        ],

        views: [
            new FeedViewJSON(),
        ],
    }
);
```

A single registration describes

* automatic collection CRUD operations
* custom resource operations
* middleware
* content negotiation
* persistence
* HTTP semantics

without manually wiring route handlers.

---

# Automatic Collection Resources

Collection resources can automatically expose CRUD endpoints.

```js
router.resource("/feeds", feed, {
    collection: true
});
```

generates

```text
GET     /feeds
GET     /feeds/:id
POST    /feeds
PUT     /feeds/:id
DELETE  /feeds/:id
```

Methods may be restricted using `allowedMethods`.

```js
allowedMethods: [
    "GET",
    "POST"
]
```

Pistachio automatically returns

```text
405 Method Not Allowed
```

for unsupported methods while still distinguishing them from missing resources (`404 Not Found`).

---

# Resource Lifecycle

Every request follows the same pipeline.

```text
HTTP Request
      │
      ▼
Route Resolution
      │
      ▼
Middleware
      │
      ▼
Domain Operation
      │
      ▼
Persistence
      │
      ▼
Content Negotiation
      │
      ▼
Resource View
      │
      ▼
HTTP Response
```

Each stage has a single responsibility and remains independently replaceable.

---

# Current Features

* Resource-oriented routing
* Automatic collection CRUD generation
* Declarative resource operations
* Middleware pipeline
* Pluggable persistence
* HTTP content negotiation
* Resource views
* Proper HTTP status semantics (404, 405, 406)
* Automatic `Allow` headers
* URLPattern-based route matching

---

# Project Status

Pistachio is currently in active development.

The framework is still exploring its resource model, and APIs should be considered experimental until a stable 1.0 release.

Current areas of exploration include:

* richer resource metadata
* hypermedia support
* authorization policies
* versioned resource views
* automated API documentation
* improved content negotiation
* additional persistence adapters

---

# License

MIT
