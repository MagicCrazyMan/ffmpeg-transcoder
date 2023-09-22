import { Descriptions, Image, Tag } from "@arco-design/web-react";
import { useMemo } from "react";
import FFmpegDarkThemeLogo from "../assets/ffmpeg_dark_theme.svg";
import FFmpegLightThemeLogo from "../assets/ffmpeg_light_theme.svg";
import { useAppStore } from "../store";

/**
 * A particular page informing ffmpeg and system basic information.
 */
export default function ParticularsPage() {
  const darkTheme = useAppStore((state) => state.theme);

  const systemParticulars = useAppStore((state) => state.systemParticulars!);
  const descriptionsData = useMemo(() => {
    const libraries = Object.entries(systemParticulars.ffmpeg.banner.libraries).map(
      ([lib, [a, b, c, d, e, f]]) => (
        <Tag className="m-1">
          {lib} {`${a}.${b}.${c} / ${d}.${e}.${f}`}
        </Tag>
      )
    );
    const configurations = systemParticulars.ffmpeg.banner.build_configurations.map((config) => (
      <Tag className="m-1">{config}</Tag>
    ));

    return [
      // FFmpeg Logo
      {
        label: "",
        value: (
          <Image
            preview={false}
            src={darkTheme ? FFmpegDarkThemeLogo : FFmpegLightThemeLogo}
          ></Image>
        ),
      },
      {
        label: "Version",
        value: systemParticulars.ffmpeg.banner.version ?? "Unknown",
      },
      {
        label: "Copyright",
        value: systemParticulars.ffmpeg.banner.copyright ?? "Copyright Unspecified",
      },
      {
        label: "Compiler",
        value: systemParticulars.ffmpeg.banner.compiler ?? "Unknown Compiler",
      },
      {
        label: "Libraries",
        value: libraries,
      },
      {
        label: "Configurations",
        value: configurations,
      },
    ];
  }, [systemParticulars, darkTheme]);

  return (
    <Descriptions
      column={1}
      labelStyle={{ verticalAlign: "top" }}
      data={descriptionsData}
    ></Descriptions>
  );
}
