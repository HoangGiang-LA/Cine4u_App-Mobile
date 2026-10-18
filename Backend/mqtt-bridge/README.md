
# MQTT Bridge

This service connects the MQTT Broker with
English Battle's trusted backend.

## Responsibilities
- Subscribe to authorized battle events
- Publish server-approved notifications
- Synchronize battle event notifications
- Handle reconnections and duplicate messages

## Security
- Use TLS
- Authenticate broker connections
- Enforce topic permissions
- Never trust client-submitted scores
