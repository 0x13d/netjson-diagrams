//! netjson-diagrams — convert NetJSON documents into PlantUML deployment /
//! component diagrams plus a Markdown paper of the metadata that doesn't fit
//! the diagram.
//!
//! See `SPEC.md` for the authoritative conversion contract.

pub mod detect;
pub mod ir;
pub mod label;
pub mod normalize;
pub mod paper;
pub mod render;
pub mod sprites;

#[cfg(feature = "wasm")]
pub mod wasm;

use render::Direction;

#[derive(serde::Deserialize, Default, Debug, Clone)]
pub struct ConvertOptions {
    #[serde(default)]
    pub direction: DirectionOpt,
}

#[derive(serde::Deserialize, Default, Debug, Clone, Copy)]
#[serde(rename_all = "UPPERCASE")]
pub enum DirectionOpt {
    #[default]
    TD,
    LR,
}

impl From<DirectionOpt> for Direction {
    fn from(d: DirectionOpt) -> Self {
        match d {
            DirectionOpt::TD => Direction::TopDown,
            DirectionOpt::LR => Direction::LeftRight,
        }
    }
}

fn parse_json(netjson_json: &str) -> Result<serde_json::Value, String> {
    serde_json::from_str(netjson_json).map_err(|e| format!("Invalid JSON: {e}"))
}

fn ir_from_json(json: &serde_json::Value) -> Result<ir::NetJsonIR, String> {
    let kind = detect::detect(json)?;
    normalize::normalize(json, kind)
}

pub fn convert(netjson_json: &str, opts: &ConvertOptions) -> Result<String, String> {
    let json = parse_json(netjson_json)?;
    let ir = ir_from_json(&json)?;
    let render_opts = render::RenderOptions {
        direction: opts.direction.into(),
    };
    Ok(render::render(&ir, &render_opts))
}

pub fn convert_paper(netjson_json: &str) -> Result<String, String> {
    let json = parse_json(netjson_json)?;
    let ir = ir_from_json(&json)?;
    Ok(paper::render_paper(&ir))
}

pub fn convert_combined(netjson_json: &str, opts: &ConvertOptions) -> Result<String, String> {
    let json = parse_json(netjson_json)?;
    let ir = ir_from_json(&json)?;
    let render_opts = render::RenderOptions {
        direction: opts.direction.into(),
    };
    let plantuml = render::render(&ir, &render_opts);
    Ok(paper::render_combined(&ir, &plantuml))
}
