/**
 * Converts a numerical value in seconds to duration.
 * @param value Numerical value in seconds.
 */
export const toDuration = (value: number | string) => {
  const num = typeof value === "number" ? value : parseFloat(value);
  const hours = Math.floor(num / 3600);
  const mins = Math.floor(num / 60 - hours * 60);
  const secs = (num % 60).toFixed(3);

  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(6, "0")}`;
};

/**
 * Converts a numerical value to file size.
 * @param value Numerical value.
 */
export const toFileSize = (value: number | string) => {
  const num = typeof value === "number" ? value : parseInt(value);
  if (num <= 1024) {
    return `${num} Bytes`;
  } else if (num <= 1024 * 1024) {
    return `${(num / 1024).toFixed(2)} KiB`;
  } else if (num <= 1024 * 1024 * 1024) {
    return `${(num / 1024 / 1024).toFixed(2)} MiB`;
  } else {
    return `${(num / 1024 / 1024 / 1024).toFixed(2)} GiB`;
  }
};

/**
 * Converts a numerical value to bitrate.
 * @param value Numerical value.
 */
export const toBitrate = (value: number | string) => {
  const num = typeof value === "number" ? value : parseInt(value);
  if (num <= 1000) {
    return `${num} bits/s`;
  } else if (num <= 1000 * 1000) {
    return `${(num / 1000).toFixed(2)} Kb/s`;
  } else if (num <= 1000 * 1000 * 1000) {
    return `${(num / 1000 / 1000).toFixed(2)} Mb/s`;
  } else {
    return `${(num / 1000 / 1000 / 1000).toFixed(2)} Gb/s`;
  }
};
