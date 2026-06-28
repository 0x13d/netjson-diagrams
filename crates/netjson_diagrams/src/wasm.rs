//! WASM surface — exposed only with `--features wasm`.
//! See `SPEC.md#public-api-surface`.

use wasm_bindgen::prelude::*;

use crate::{convert, convert_combined, convert_paper, ConvertOptions};

fn parse_opts(options_json: &str) -> Result<ConvertOptions, JsValue> {
    if options_json.trim().is_empty() {
        return Ok(ConvertOptions::default());
    }
    serde_json::from_str::<ConvertOptions>(options_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid options JSON: {e}")))
}

#[wasm_bindgen]
pub fn convert_to_plantuml(netjson_json: &str, options_json: &str) -> Result<String, JsValue> {
    let opts = parse_opts(options_json)?;
    convert(netjson_json, &opts).map_err(|e| JsValue::from_str(&e))
}

#[wasm_bindgen]
pub fn convert_to_paper(netjson_json: &str) -> Result<String, JsValue> {
    convert_paper(netjson_json).map_err(|e| JsValue::from_str(&e))
}

#[wasm_bindgen]
pub fn convert_to_combined(netjson_json: &str, options_json: &str) -> Result<String, JsValue> {
    let opts = parse_opts(options_json)?;
    convert_combined(netjson_json, &opts).map_err(|e| JsValue::from_str(&e))
}
