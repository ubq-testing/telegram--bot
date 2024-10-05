import manifest from "../../../manifest.json";
type Manifest = typeof manifest;

export function getPluginManifestDetails() {
  return manifest as Manifest;
}
