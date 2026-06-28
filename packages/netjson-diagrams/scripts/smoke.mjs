import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import {
  netjsonToCombined,
  netjsonToPaper,
  netjsonToPlantuml,
} from '../dist/index.node.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = resolve(here, '../../../tests/fixtures');

let pass = 0;
let fail = 0;

function check(name, cond, detail) {
  if (cond) {
    pass++;
    console.log(`  ok  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function smoke() {
  const graph = readFileSync(resolve(fixtures, 'network_graph_mesh.json'), 'utf8');
  const config = readFileSync(resolve(fixtures, 'device_configuration_router.json'), 'utf8');
  const monitoring = readFileSync(resolve(fixtures, 'device_monitoring_router.json'), 'utf8');
  const routes = readFileSync(resolve(fixtures, 'network_routes_basic.json'), 'utf8');
  const collection = readFileSync(resolve(fixtures, 'network_collection_mixed.json'), 'utf8');

  console.log('• NetworkGraph baseline');
  const out1 = await netjsonToPlantuml(graph);
  check('starts with @startuml', out1.startsWith('@startuml'));
  check('uses TD by default', out1.includes('top to bottom direction'));
  check('includes the C4 Container stdlib', out1.includes('!include <C4/C4_Container>'));
  check('renders the Gateway node', out1.includes('Container(n_10_0_0_1, "Gateway", "Router", "vendor: Ubiquiti")'));
  check('emits cost label on link', out1.includes('"ETX 1.0"'));

  console.log('• NetworkGraph with LR + labelResolver');
  const out2 = await netjsonToPlantuml(graph, {
    direction: 'LR',
    labelResolver: (kind, id) =>
      kind === 'node' && id === '10.0.0.1' ? 'Edge Gateway' : undefined,
  });
  check('respects direction LR', out2.includes('left to right direction'));
  check('resolver overrides node label',
    out2.includes('Container(n_10_0_0_1, "Edge Gateway", "Router", "vendor: Ubiquiti")'));
  check('untouched nodes remain', out2.includes('Container(n_10_0_0_2, "AP-North", "AP")'));

  console.log('• DeviceConfiguration');
  const out3 = await netjsonToPlantuml(config);
  check('emits device block', out3.includes('"Device · router-01" as device'));
  check('emits interface components', out3.includes('"eth0" as iface_eth0'));
  check('emits radio outside device block', out3.includes('"Radio radio0" as radio_radio0'));
  check('emits bridge member edges', out3.includes('iface_br_lan ..> iface_eth0'));
  check('emits wireless → radio edge', out3.includes('iface_wlan0 ..> radio_radio0'));

  console.log('• DeviceMonitoring rx/tx notes');
  const out4 = await netjsonToPlantuml(monitoring);
  check('emits rx note', out4.includes('rx 1000.0 MB'));
  check('emits tx note', out4.includes('tx 500.0 MB'));
  check('note bound to eth0', out4.includes('note right of iface_eth0'));

  console.log('• NetworkRoutes');
  const out5 = await netjsonToPlantuml(routes);
  check('emits router node', out5.includes('"Router 10.0.0.1" as router'));
  check('emits destination cloud', out5.includes('"0.0.0.0/0" as dest_0_0_0_0_0'));
  check('emits route arrow label',
    out5.includes('router --> dest_0_0_0_0_0 : "via 10.0.0.254 (eth0) cost 1"'));

  console.log('• NetworkCollection multi-block');
  const out6 = await netjsonToPlantuml(collection);
  const startCount = (out6.match(/@startuml/g) || []).length;
  const endCount = (out6.match(/@enduml/g) || []).length;
  check('emits two @startuml blocks', startCount === 2);
  check('emits two @enduml blocks', endCount === 2);

  console.log('• object input matches string input');
  const out7 = await netjsonToPlantuml(JSON.parse(graph));
  check('object input matches', out7 === out1);

  console.log('• invalid JSON rejects');
  let caught = false;
  try {
    await netjsonToPlantuml('{not json');
  } catch {
    caught = true;
  }
  check('throws on invalid JSON', caught);

  console.log('• netjsonToPaper');
  const paper = await netjsonToPaper(graph);
  check('paper has document title', paper.startsWith('# Coffeeshop Mesh'));
  check('paper exposes anchor', paper.includes('<!-- netjson-section: nodes -->'));
  check('paper shows non-icon properties', paper.includes('**vendor:** `Ubiquiti`'));

  console.log('• netjsonToCombined');
  const combined = await netjsonToCombined(graph);
  check('combined has Diagram heading', combined.includes('## Diagram'));
  check('combined wraps fenced plantuml', combined.includes('```plantuml'));
  check('combined has Paper heading', combined.includes('## Paper'));

  console.log('• netjsonToCombined with labelResolver rewrites inside fence only');
  const combinedR = await netjsonToCombined(graph, {
    labelResolver: (kind, id) =>
      kind === 'node' && id === '10.0.0.1' ? 'Edge Gateway' : undefined,
  });
  check('diagram label rewritten', combinedR.includes('Container(n_10_0_0_1, "Edge Gateway", "Router", "vendor: Ubiquiti")'));
  check('paper section untouched', combinedR.includes('### Gateway'));

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

smoke().catch((e) => {
  console.error('smoke crashed:', e);
  process.exit(2);
});
