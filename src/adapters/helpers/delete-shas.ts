import { Withsha } from "../../types/storage";

/**
 * Recursively delete all `sha` properties from an object.
 *
 * I remove these because the 'sha' can often cause troubles when pushing for instance,
 * so extract the sha and remove all of them from the object.
 *
 * Prior to push, we use the extracted sha or fetch the latest from Github for the given object.
 *
 * Probably ideally, right before push we re-fetch and revalidate the storage object with our
 * now fully built ready-to-push object. This requires API limit considerations and would
 * be better served with a dedicated app for the GitHub storage layer.
 */

export function deleteAllShas<T extends Withsha>(data: T) {
  Object.keys(data).forEach((key) => {
    const value = data[key as keyof typeof data];

    if (key === "sha") {
      Reflect.deleteProperty(data, key);
    }

    if (typeof value === "object" && value) {
      deleteAllShas(value);
    }

    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (typeof item === "object" && item) {
          deleteAllShas(item);
        }
      });
    }
  });

  return data;
}
