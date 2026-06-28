import networkGraphMesh from '../../../tests/fixtures/network_graph_mesh.json?raw';
import deviceConfigurationRouter from '../../../tests/fixtures/device_configuration_router.json?raw';
import deviceMonitoringRouter from '../../../tests/fixtures/device_monitoring_router.json?raw';
import networkRoutesBasic from '../../../tests/fixtures/network_routes_basic.json?raw';
import networkCollectionMixed from '../../../tests/fixtures/network_collection_mixed.json?raw';
import networkGraphPivIssuance from '../../../tests/fixtures/network_graph_piv_issuance.json?raw';

export interface Sample {
  slug: string;
  label: string;
  description: string;
  json: string;
}

export const SAMPLES: Sample[] = [
  {
    slug: 'network-graph',
    label: 'NetworkGraph',
    description: 'Three-node mesh with cost-labelled OLSR links',
    json: networkGraphMesh,
  },
  {
    slug: 'network-graph-piv',
    label: 'NetworkGraphPivIssuance',
    description: 'PIV Issuance & Relying-Party Topology',
    json: networkGraphPivIssuance,
  },
  {
    slug: 'device-config',
    label: 'DeviceConfiguration',
    description: 'OpenWRT router: eth0 + wlan0 in a br-lan bridge, one radio',
    json: deviceConfigurationRouter,
  },
  {
    slug: 'device-monitoring',
    label: 'DeviceMonitoring',
    description: 'Same router with interface rx/tx and resource stats',
    json: deviceMonitoringRouter,
  },
  {
    slug: 'routes',
    label: 'NetworkRoutes',
    description: 'Routing table with static, kernel, and OLSR-sourced entries',
    json: networkRoutesBasic,
  },
  {
    slug: 'collection',
    label: 'NetworkCollection',
    description: 'A NetworkGraph + a DeviceConfiguration in one document',
    json: networkCollectionMixed,
  },
];

export const DEFAULT_SAMPLE = SAMPLES[0];
