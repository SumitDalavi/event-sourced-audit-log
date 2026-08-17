# event-sourced-audit-log Architecture

## System Diagram
The following Mermaid.js sequence diagram maps the core workflow and interactions:

```mermaid
sequenceDiagram
    Service->>AppendLog: Write Event
AppendLog->>EventStore: Save
EventStore-)Projector: Async Event
Projector->>ReadModel: Update view
```

## Component Breakdown
- **Core Technology**: Node.js, CQRS
- **Design Paradigm**: Emphasizes high availability, fault tolerance, and security.

## Security & Scaling Considerations
- Strict boundary validations.
- Horizontal scalability achieved via stateless workers.
- Encrypted data at rest and in transit.
