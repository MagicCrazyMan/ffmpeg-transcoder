import { Collapse, Descriptions, Modal, Tabs, Typography } from "@arco-design/web-react";
import { DataType } from "@arco-design/web-react/es/Descriptions/interface";
import { useMemo } from "react";
import { useTaskStore } from "../../store/task";
import { AudioStream, Format, VideoStream, getMediaMetadata } from "../../tauri/task";
import { toBitrate, toDuration, toFileSize } from "../../utils";

const OverviewMetadata = ({ format }: { format: Format }) => {
  const data: DataType = [
    {
      label: "Filename",
      value: format.filename,
    },
    {
      label: "Size",
      value: toFileSize(format.size),
    },
    {
      label: "Format",
      value: format.format_long_name,
    },
    {
      label: "Duration",
      value: toDuration(format.duration),
    },
    {
      label: "Overall Bitrate",
      value: toBitrate(format.bit_rate),
    },
  ];

  return <Descriptions column={1} size="mini" title="Overview" data={data}></Descriptions>;
};

const VideoMetadata = ({ stream }: { stream: VideoStream }) => {
  const data: DataType = [
    {
      label: "Codec",
      value: stream.codec_long_name,
    },
    {
      label: "Profile",
      value: stream.profile,
    },
    {
      label: "Resolution",
      value: `${stream.coded_width}x${stream.coded_height}`,
    },
    {
      label: "Framerate",
      value: stream.coded_height,
    },
    {
      label: "Pixel Format",
      value: stream.pix_fmt,
    },
  ];

  return (
    <Descriptions size="mini" column={1} title={`Video Stream #${stream.index}`} data={data} />
  );
};

const Metadata = ({ taskId }: { taskId?: string }) => {
  const tasks = useTaskStore((state) => state.tasks);
  const task = useMemo(
    () => (taskId ? tasks.find((task) => task.id === taskId) : undefined),
    [tasks, taskId]
  );

  const updateTask = useTaskStore((state) => state.updateTask);

  if (!task) return <></>;

  if (Array.isArray(task.metadata)) {
    const metadata = task.metadata.map(({ format, streams }, index) => {
      const videoStreams: VideoStream[] = [];
      const audioStreams: AudioStream[] = [];
      streams.forEach((stream) => {
        if (stream.codec_type === "audio") {
          audioStreams.push(stream);
        } else if (stream.codec_type === "video") {
          videoStreams.push(stream);
        }
      });

      const videoStreamsMetadata = videoStreams.map((stream) => <VideoMetadata stream={stream} />);

      return (
        <Collapse.Item name={index.toString()} header={format.filename}>
          <OverviewMetadata format={format} />
          {videoStreamsMetadata}
        </Collapse.Item>
      );
    });

    return <Collapse bordered={false}>{metadata}</Collapse>;
  } else if (task.metadata) {
    return <Typography.Paragraph>Metadata Not Found</Typography.Paragraph>;
  } else {
    updateTask(task.id, { metadata: true });
    const promises = task.params.inputs.map((input) => getMediaMetadata(input.path));
    Promise.all(promises)
      .then((metadata) => updateTask(task.id, { metadata }))
      .catch(() => {
        updateTask(task.id, { metadata: false });
      });

    return <></>;
  }
};

export default function Details({ taskId, onClosed }: { taskId?: string; onClosed: () => void }) {
  const visible = useMemo(() => !!taskId, [taskId]);

  return (
    <Modal
      simple
      style={{
        maxWidth: "80%",
        width: "auto",
        minWidth: "464px",
        maxHeight: "90%",
        overflowY: "auto",
      }}
      visible={visible}
      onCancel={onClosed}
      onOk={onClosed}
    >
      <Tabs defaultActiveTab="metadata">
        <Tabs.TabPane key="metadata" title="Inputs Params">
          <Metadata taskId={taskId} />
        </Tabs.TabPane>
        <Tabs.TabPane key="codec" title="Output Params"></Tabs.TabPane>
      </Tabs>
    </Modal>
  );
}
