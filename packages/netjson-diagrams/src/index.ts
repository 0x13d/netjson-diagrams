import {
  convert_to_combined,
  convert_to_paper,
  convert_to_plantuml,
} from '../wasm/netjson_diagrams.js';
import {
  makeNetjsonToCombined,
  makeNetjsonToPaper,
  makeNetjsonToPlantuml,
} from './core.js';

export type { LabelResolver } from './resolver.js';
export type { ConvertOptions } from './core.js';

export const netjsonToPlantuml = makeNetjsonToPlantuml(convert_to_plantuml);
export const netjsonToPaper = makeNetjsonToPaper(convert_to_paper);
export const netjsonToCombined = makeNetjsonToCombined(convert_to_combined);
