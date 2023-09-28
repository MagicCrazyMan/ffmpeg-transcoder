import { Button, Table, TableColumnProps } from "@arco-design/web-react";
import { IconPause, IconPlayArrow, IconRecordStop } from "@arco-design/web-react/icon";
import { pauseTranscode, resumeTranscode, startTranscode, stopTranscode } from "../tauri/transcode";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef, useState } from "react";

export default function QueuePage() {
  const tableCols: TableColumnProps[] = [
    {
      title: "Input",
      dataIndex: "input",
    },
    {
      title: "Output",
      dataIndex: "output",
    },
    {
      title: "Progress",
      dataIndex: "progress",
    },
  ];

  const transcodeId = useRef("");
  const [transcodePaused, setTranscodePaused] = useState(false);
  const start = async () => {
    const { id } = await startTranscode({
      inputs: [{ path: "D:\\Captures\\2023-09-10 23-35-22.mp4", params: ["-c:v", "av1_cuvid"] }],
      outputs: [
        {
          path: "F:\\Transcode\\2023-09-10 23-35-22(2).mp4",
          params: [
            "-c:v",
            "hevc_nvenc",
            "-preset",
            "slow",
            "-x265-params",
            "lossless=1",
            "-c:a",
            "copy",
          ],
        },
      ],
    });

    transcodeId.current = id;
  };
  const stop = async () => {
    if (!transcodeId.current) return;

    await stopTranscode(transcodeId.current);
  };
  const pause = async () => {
    if (!transcodeId.current) return;

    await pauseTranscode(transcodeId.current);
    setTranscodePaused(true);
  };
  const resume = async () => {
    if (!transcodeId.current) return;

    await resumeTranscode(transcodeId.current);
    setTranscodePaused(false);
  };

  useEffect(() => {
    const unlistenPromise = listen("transcoding", (event) => {
      console.log(event.payload);
    });

    return () => {
      unlistenPromise.then((unlisten) => {
        console.log(1);

        unlisten();
      });
    };
  }, []);

  return (
    <>
      <div className="mb-4">
        <Button
          className="mr-2"
          shape="circle"
          size="large"
          type="primary"
          icon={<IconPlayArrow />}
          onClick={start}
        ></Button>
        <Button
          className="mr-2"
          shape="circle"
          size="large"
          status="warning"
          type="primary"
          icon={<IconPause />}
          onClick={transcodePaused ? resume : pause}
        ></Button>
        <Button
          className="mr-2"
          shape="circle"
          size="large"
          status="danger"
          type="primary"
          icon={<IconRecordStop />}
          onClick={stop}
        ></Button>
      </div>
      <Table columns={tableCols}></Table>
    </>
  );
}
