# netjson-diagrams

Convert [NetJSON](https://netjson.org/) documents (NetworkGraph,
DeviceConfiguration, DeviceMonitoring, NetworkRoutes, NetworkCollection) into
[PlantUML](https://plantuml.com/) deployment / component diagrams. Powered by a
Rust core compiled to WebAssembly; runs offline in both Node and the browser.

```ts
import { netjsonToPlantuml, netjsonToPaper, netjsonToCombined } from 'netjson-diagrams';

const diagram = await netjsonToPlantuml(networkGraphJson, {
  direction: 'LR',
  labelResolver: (kind, id) =>
    kind === 'node' && id === '10.0.0.1' ? 'Gateway' : undefined,
});

const paper = await netjsonToPaper(networkGraphJson);
```

`labelResolver` runs client-side as a post-processing pass on the PlantUML
output. Returning `undefined` falls through to the default label.

Sprite includes resolve via PlantUML's bundled stdlib (`!include <tupadr3/...>`)
— no third-party network calls at render time. See the
[project repo](https://github.com/ariugwu/netjson-diagrams) for full docs.
