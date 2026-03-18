import { createTheme, type MantineColorsTuple } from "@mantine/core";

// generate your own set of colors here: https://mantine.dev/colors-generator
const brandColor: MantineColorsTuple = [
  "#ffebff",
  "#f5d5fb",
  "#e6a8f3",
  "#d779eb",
  "#cb51e4",
  "#c337e0",
  "#c029df",
  "#a91cc6",
  "#9715b1",
  "#84099c",
];

export const theme = createTheme({
  primaryColor: "brand",
  colors: {
    brand: brandColor,
  },
});
