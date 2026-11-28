# SPDX-FileCopyrightText: 2026 ELIXIR On-Cloud <cloud-service@elixir-europe.org>
#
# SPDX-License-Identifier: Apache-2.0

version 1.1

# The demo workflow of the GA4GH I/O Schema (see docs/adoption/demo.md):
# filters, sorts and indexes aligned reads, and writes an HTML report and a
# table of read counts per reference sequence.
# Its I/O Schema, ga4gh-io.schema.json, is generated from this document by
# build_schema.py; change both together.

workflow io_schema_demo {
  meta {
    description: "Filters aligned reads by mapping quality and flags, sorts and indexes them, and reports alignment statistics."
  }

  input {
    File reads
    Int min_mapq = 0
    String read_filter = "none"
  }

  parameter_meta {
    reads: {
      label: "Aligned reads (BAM)",
      description: "Reads aligned to a reference, in BAM format, in any order."
    }
    min_mapq: {
      label: "Minimum mapping quality",
      description: "Reads with a lower mapping quality are removed (0 keeps all reads)."
    }
    read_filter: {
      label: "Read filter",
      description: "Which reads to keep besides the mapping quality: all, properly paired only, or primary alignments only.",
      choices: ["none", "proper_pairs", "primary_only"]
    }
    filtered_bam: {
      label: "Filtered reads (BAM)",
      description: "The filtered reads, sorted by coordinate."
    }
    filtered_bam_index: {
      label: "Index of the filtered reads (BAI)",
      description: "The index of the filtered reads."
    }
    report: {
      label: "Alignment report (HTML)",
      description: "Statistics of the reads before and after filtering."
    }
    read_counts: {
      label: "Read counts per reference (TSV)",
      description: "Mapped and unmapped reads per reference sequence, before and after filtering; unmapped reads without a position are counted under *."
    }
  }

  call filter_sort_index {
    input:
      reads = reads,
      min_mapq = min_mapq,
      read_filter = read_filter
  }

  call make_report {
    input:
      reads = reads,
      filtered_bam = filter_sort_index.bam,
      min_mapq = min_mapq,
      read_filter = read_filter
  }

  call count_reads {
    input:
      reads = reads,
      filtered_bam = filter_sort_index.bam
  }

  output {
    File filtered_bam = filter_sort_index.bam
    File filtered_bam_index = filter_sort_index.bai
    File report = make_report.html
    File read_counts = count_reads.tsv
  }
}

task filter_sort_index {
  input {
    File reads
    Int min_mapq
    String read_filter
  }

  command <<<
    set -euo pipefail
    # Read from a file, not interpolated into the script: clients that skip
    # the schema can send any string.
    read_filter=$(cat ~{write_lines([read_filter])})
    case "$read_filter" in
      none) flags="" ;;
      proper_pairs) flags="-f 2" ;;
      primary_only) flags="-F 0x900" ;;
      *) echo "Unknown read filter" >&2; exit 1 ;;
    esac
    # shellcheck disable=SC2086
    samtools view -b -q ~{min_mapq} $flags "~{reads}" \
      | samtools sort -o filtered.bam -
    samtools index filtered.bam filtered.bam.bai
  >>>

  output {
    File bam = "filtered.bam"
    File bai = "filtered.bam.bai"
  }

  runtime {
    docker: "quay.io/biocontainers/samtools:1.24--h9dcdb79_1"
    cpu: 1
    memory: "1 GiB"
  }
}

task make_report {
  input {
    File reads
    File filtered_bam
    Int min_mapq
    String read_filter
  }

  command <<<
    set -euo pipefail
    read_filter=$(cat ~{write_lines([read_filter])})  # see filter_sort_index
    case "$read_filter" in
      none|proper_pairs|primary_only) ;;
      *) echo "Unknown read filter" >&2; exit 1 ;;
    esac
    samtools flagstat "~{reads}" > before.txt
    samtools flagstat "~{filtered_bam}" > after.txt
    {
      echo '<!DOCTYPE html>'
      echo '<html lang="en"><head><meta charset="utf-8">'
      echo '<title>Alignment report</title></head><body>'
      echo '<h1>Alignment report</h1>'
      echo "<p>Minimum mapping quality: ~{min_mapq}; read filter: $read_filter.</p>"
      echo '<h2>Before filtering</h2><pre>'
      sed 's/&/\&amp;/g; s/</\&lt;/g; s/>/\&gt;/g' before.txt
      echo '</pre><h2>After filtering</h2><pre>'
      sed 's/&/\&amp;/g; s/</\&lt;/g; s/>/\&gt;/g' after.txt
      echo '</pre></body></html>'
    } > report.html
  >>>

  output {
    File html = "report.html"
  }

  runtime {
    docker: "quay.io/biocontainers/samtools:1.24--h9dcdb79_1"
    cpu: 1
    memory: "1 GiB"
  }
}

task count_reads {
  input {
    File reads
    File filtered_bam
  }

  command <<<
    set -euo pipefail
    # Without an index, idxstats reads the whole file
    samtools idxstats "~{reads}" > before.tsv
    samtools idxstats "~{filtered_bam}" > after.tsv
    # Joined by name, in the order of the input's header; the last line, *,
    # counts the unmapped reads without a position
    awk -F '\t' -v OFS='\t' '
      NR == FNR { mapped[$1] = $3; unmapped[$1] = $4; next }
      FNR == 1 {
        print "reference", "length", "mapped_before", "unmapped_before",
          "mapped_after", "unmapped_after"
      }
      { print $1, $2, $3, $4, mapped[$1] + 0, unmapped[$1] + 0 }
    ' after.tsv before.tsv > read_counts.tsv
  >>>

  output {
    File tsv = "read_counts.tsv"
  }

  runtime {
    docker: "quay.io/biocontainers/samtools:1.24--h9dcdb79_1"
    cpu: 1
    memory: "1 GiB"
  }
}
