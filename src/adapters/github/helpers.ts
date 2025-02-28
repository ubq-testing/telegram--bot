import { Withsha } from "../../types/storage";

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
