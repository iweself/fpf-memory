export const DEFAULT_UPSTREAM_REF = 'main';
export const DEFAULT_UPSTREAM_OWNER = 'venikman';
export const DEFAULT_UPSTREAM_REPO = 'fpf-sync';
export const DEFAULT_UPSTREAM_SPEC_PATH = 'FPF/FPF-Spec.md';
export const DEFAULT_UPSTREAM_REPO_URL = `https://github.com/${DEFAULT_UPSTREAM_OWNER}/${DEFAULT_UPSTREAM_REPO}`;

export interface UpstreamSpecSourceConfig {
  owner?: string;
  repo?: string;
  ref?: string;
  specPath?: string;
  explicitUrl?: string;
}

export interface UpstreamSpecSource {
  owner: string;
  repo: string;
  ref: string;
  specPath: string;
  url: string;
}

export const DEFAULT_UPSTREAM_URL = buildUpstreamSpecUrl();

export function buildUpstreamSpecUrl(
  config: UpstreamSpecSourceConfig = {},
): string {
  const owner = normalizedValue(config.owner, DEFAULT_UPSTREAM_OWNER);
  const repo = normalizedValue(config.repo, DEFAULT_UPSTREAM_REPO);
  const ref = normalizedValue(config.ref, DEFAULT_UPSTREAM_REF);
  const specPath = normalizedSpecPath(
    normalizedValue(config.specPath, DEFAULT_UPSTREAM_SPEC_PATH),
  );

  return `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${specPath}`;
}

export function resolveUpstreamSpecUrl(
  config: UpstreamSpecSourceConfig = {},
): string {
  return normalizedOptionalValue(config.explicitUrl)
    ?? buildUpstreamSpecUrl(config);
}

export function parseUpstreamSpecSourceEnv(
  env: NodeJS.ProcessEnv,
): UpstreamSpecSource {
  const owner = normalizedValue(env.FPF_UPSTREAM_OWNER, DEFAULT_UPSTREAM_OWNER);
  const repo = normalizedValue(env.FPF_UPSTREAM_REPO, DEFAULT_UPSTREAM_REPO);
  const ref = normalizedValue(env.FPF_UPSTREAM_REF, DEFAULT_UPSTREAM_REF);
  const specPath = normalizedSpecPath(
    normalizedValue(env.FPF_UPSTREAM_SPEC_PATH, DEFAULT_UPSTREAM_SPEC_PATH),
  );
  const url = resolveUpstreamSpecUrl({
    owner,
    repo,
    ref,
    specPath,
    explicitUrl: env.FPF_UPSTREAM_SPEC_URL,
  });

  return { owner, repo, ref, specPath, url };
}

function normalizedValue(value: string | undefined, fallback: string): string {
  return normalizedOptionalValue(value) ?? fallback;
}

function normalizedOptionalValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizedSpecPath(specPath: string): string {
  return specPath.replace(/^\/+|\/+$/gu, '');
}
