import { Descriptions, Image, Input, Table, TableColumnProps, Tag } from "@arco-design/web-react";
import { DataType } from "@arco-design/web-react/es/Descriptions/interface";
import { useMemo } from "react";
import FFmpegDarkThemeLogo from "../assets/ffmpeg_dark_theme.svg";
import FFmpegLightThemeLogo from "../assets/ffmpeg_light_theme.svg";
import { Theme } from "../libs/config";
import { FFmpegCodec, FFmpegCodecType } from "../libs/particulars";
import { useAppStore } from "../store/app";

const createLibrariesDescription = (libraries: Record<string, number[]>) => {
  return Object.entries(libraries).map(([lib, [a, b, c, d, e, f]]) => (
    <Tag className="m-1" key={lib}>
      {lib} {`${a}.${b}.${c} / ${d}.${e}.${f}`}
    </Tag>
  ));
};

const createConfigurationDescription = (build_configurations: string[]) => {
  return build_configurations.map((config) => (
    <Tag className="m-1" key={config}>
      {config}
    </Tag>
  ));
};

const createHwaccelsDescription = (hwaccels: string[]) => {
  return hwaccels.map((method) => (
    <Tag className="m-1" key={method}>
      {method}
    </Tag>
  ));
};

const createCodecsDescription = (codecs: FFmpegCodec[]) => {
  const codecsColumns: TableColumnProps<FFmpegCodec>[] = [
    {
      title: "Name",
      dataIndex: "name",
      sorter: (a: FFmpegCodec, b: FFmpegCodec) => a.name.localeCompare(b.name),
      filterDropdown: ({ filterKeys, setFilterKeys, confirm }) => {
        return (
          <div className="arco-table-custom-filter">
            <Input.Search
              autoFocus
              allowClear
              searchButton
              placeholder="Please enter name"
              value={filterKeys?.[0] ?? ""}
              onChange={(value) => {
                setFilterKeys?.(value ? [value] : []);
              }}
              onSearch={() => {
                confirm?.();
              }}
            />
          </div>
        );
      },
      onFilter: (value: string, row: FFmpegCodec) => row.name.toLocaleLowerCase().includes(value),
    },
    {
      title: "Description",
      dataIndex: "description",
      filterDropdown: ({ filterKeys, setFilterKeys, confirm }) => {
        return (
          <div className="arco-table-custom-filter">
            <Input.Search
              autoFocus
              allowClear
              searchButton
              placeholder="Please enter name"
              value={filterKeys?.[0] ?? ""}
              onChange={(value) => {
                setFilterKeys?.(value ? [value] : []);
              }}
              onSearch={() => {
                confirm?.();
              }}
            />
          </div>
        );
      },
      onFilter: (value: string, row: FFmpegCodec) =>
        row.description.toLocaleLowerCase().includes(value),
    },
    {
      title: "Type",
      render(_col, item) {
        switch (item.type) {
          case FFmpegCodecType.Video:
            return "Video";
          case FFmpegCodecType.Audio:
            return "Audio";
          case FFmpegCodecType.Subtitle:
            return "Subtitle";
          case FFmpegCodecType.Data:
            return "Data";
          case FFmpegCodecType.Attachment:
            return "Attachment";
        }
      },
      sorter: (a: FFmpegCodec, b: FFmpegCodec) => a.type - b.type,
      filters: [
        { text: "Video", value: FFmpegCodecType.Video },
        { text: "Audio", value: FFmpegCodecType.Audio },
        { text: "Subtitle", value: FFmpegCodecType.Subtitle },
        { text: "Data", value: FFmpegCodecType.Data },
        { text: "Attachment", value: FFmpegCodecType.Attachment },
      ],
      onFilter: (value: number, item: FFmpegCodec) => item.type === value,
    },
    {
      title: "Decoders",
      render(_col, item) {
        return item.decoders.map((decoder) => (
          <Tag className="m-1" key={decoder}>
            {decoder}
          </Tag>
        ));
      },
    },
    {
      title: "Encoders",
      render(_col, item) {
        return item.encoders.map((encoder) => (
          <Tag className="m-1" key={encoder}>
            {encoder}
          </Tag>
        ));
      },
    },
  ];

  return (
    <Table
      stripe
      virtualized
      pagination={false}
      size="mini"
      columns={codecsColumns}
      data={codecs}
      scroll={{ y: "30rem" }}
    />
  );
};

/**
 * A page informing ffmpeg and system basic information.
 */
export default function ParticularsPage() {
  const currentTheme = useAppStore((state) => state.currentTheme);

  const systemParticulars = useAppStore((state) => state.systemParticulars!);
  const descriptionsData = useMemo(() => {
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
        value: createLibrariesDescription(systemParticulars.ffmpeg.banner.libraries),
      },
      {
        label: "Configurations",
        value: createConfigurationDescription(systemParticulars.ffmpeg.banner.build_configurations),
      },
      {
        label: "Hwaccels",
        value: createHwaccelsDescription(systemParticulars.ffmpeg.hwaccels),
      },
      {
        label: "Codecs",
        value: createCodecsDescription(systemParticulars.ffmpeg.codecs),
      },
    ] as DataType;
  }, [systemParticulars, currentTheme]);

  return (
    <div className="p-4">
      <Descriptions column={1} data={descriptionsData}></Descriptions>
    </div>
  );
}
