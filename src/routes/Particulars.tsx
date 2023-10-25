import { Descriptions, Image, Tag } from "@arco-design/web-react";
import { useMemo } from "react";
import FFmpegDarkThemeLogo from "../assets/ffmpeg_dark_theme.svg";
import FFmpegLightThemeLogo from "../assets/ffmpeg_light_theme.svg";
import { Theme } from "../libs/config";
import { useAppStore } from "../store/app";
import { DataType } from "@arco-design/web-react/es/Descriptions/interface";

/**
 * A page informing ffmpeg and system basic information.
 */
export default function ParticularsPage() {
  const currentTheme = useAppStore((state) => state.currentTheme);

  const systemParticulars = useAppStore((state) => state.systemParticulars!);
  const descriptionsData = useMemo(() => {
    const libraries = Object.entries(systemParticulars.ffmpeg.banner.libraries).map(
      ([lib, [a, b, c, d, e, f]]) => (
        <Tag className="m-1" key={lib}>
          {lib} {`${a}.${b}.${c} / ${d}.${e}.${f}`}
        </Tag>
      )
    );
    const configurations = systemParticulars.ffmpeg.banner.build_configurations.map((config) => (
      <Tag className="m-1" key={config}>
        {config}
      </Tag>
    ));
    const hwaccels = systemParticulars.ffmpeg.hwaccels.map((method) => (
      <Tag className="m-1" key={method}>
        {method}
      </Tag>
    ));

    return [
      // FFmpeg Logo
      {
        label: "",
        value: (
          <Image
            preview={false}
            src={currentTheme === Theme.Dark ? FFmpegDarkThemeLogo : FFmpegLightThemeLogo}
          ></Image>
        ),
      },
      {
        label: "Version",
        value: systemParticulars.ffmpeg.banner.version ?? "Unknown Version",
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
      {
        label: "Hwaccels",
        value: hwaccels,
      },
    ] as DataType;
  }, [systemParticulars, currentTheme]);

  return (
    <div className="p-4">
      <Descriptions
        column={1}
        data={descriptionsData}
      ></Descriptions>
    </div>
  );
}
