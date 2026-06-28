//! `netjson-diagrams` CLI. See `SPEC.md#cli-netjson-diagrams`.

use std::fs;
use std::io::{self, Read, Write};
use std::path::PathBuf;
use std::process::ExitCode;

use clap::{Parser, ValueEnum};
use netjson_diagrams::{convert, convert_combined, convert_paper, ConvertOptions, DirectionOpt};

#[derive(Parser, Debug)]
#[command(
    name = "netjson-diagrams",
    version,
    about = "Convert NetJSON documents into PlantUML deployment/component diagrams."
)]
struct Args {
    /// Input file (omit to read stdin).
    input: Option<PathBuf>,

    /// Write to FILE (default: stdout).
    #[arg(short, long)]
    output: Option<PathBuf>,

    /// Diagram layout direction.
    #[arg(short, long, value_enum, default_value_t = DirArg::Td)]
    direction: DirArg,

    /// Output format.
    #[arg(short, long, value_enum, default_value_t = Format::Plantuml)]
    format: Format,

    /// Shorthand for --format paper.
    #[arg(long, conflicts_with_all = ["combined", "format"])]
    paper: bool,

    /// Shorthand for --format combined.
    #[arg(long, conflicts_with_all = ["paper", "format"])]
    combined: bool,

    /// Wrap PlantUML output in a fenced code block (ignored for non-plantuml formats).
    #[arg(long)]
    fenced: bool,
}

#[derive(Clone, Copy, Debug, ValueEnum)]
enum DirArg {
    Td,
    Lr,
}

impl From<DirArg> for DirectionOpt {
    fn from(d: DirArg) -> Self {
        match d {
            DirArg::Td => DirectionOpt::TD,
            DirArg::Lr => DirectionOpt::LR,
        }
    }
}

#[derive(Clone, Copy, Debug, ValueEnum, PartialEq, Eq)]
enum Format {
    Plantuml,
    Paper,
    Combined,
}

fn main() -> ExitCode {
    let args = Args::parse();
    match run(args) {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("error: {e}");
            ExitCode::FAILURE
        }
    }
}

fn run(args: Args) -> Result<(), String> {
    let input = read_input(args.input.as_deref())?;

    let format = if args.paper {
        Format::Paper
    } else if args.combined {
        Format::Combined
    } else {
        args.format
    };

    let opts = ConvertOptions {
        direction: args.direction.into(),
    };

    let out = match format {
        Format::Plantuml => {
            let mut s = convert(&input, &opts)?;
            if args.fenced {
                s = format!("```plantuml\n{}{}```\n", s, if s.ends_with('\n') { "" } else { "\n" });
            }
            s
        }
        Format::Paper => convert_paper(&input)?,
        Format::Combined => convert_combined(&input, &opts)?,
    };

    write_output(args.output.as_deref(), &out)
}

fn read_input(path: Option<&std::path::Path>) -> Result<String, String> {
    match path {
        Some(p) => fs::read_to_string(p).map_err(|e| format!("reading {}: {e}", p.display())),
        None => {
            let mut buf = String::new();
            io::stdin()
                .read_to_string(&mut buf)
                .map_err(|e| format!("reading stdin: {e}"))?;
            Ok(buf)
        }
    }
}

fn write_output(path: Option<&std::path::Path>, content: &str) -> Result<(), String> {
    match path {
        Some(p) => fs::write(p, content).map_err(|e| format!("writing {}: {e}", p.display())),
        None => io::stdout()
            .write_all(content.as_bytes())
            .map_err(|e| format!("writing stdout: {e}")),
    }
}
