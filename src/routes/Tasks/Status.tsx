import { Spin } from "@arco-design/web-react";
import {
  IconCheckCircle,
  IconCloseCircle,
  IconMore,
  IconPauseCircle,
  IconPlayCircle,
  IconRecordStop,
  IconStop,
} from "@arco-design/web-react/icon";
import { Task } from "../../store/task";

const iconSize = "20px";

export default function Progress({ task }: { task: Task }) {
  switch (task.state.type) {
    case "Idle":
      return <IconRecordStop fontSize={iconSize} />;
    case "Commanding":
      return <Spin size={20}></Spin>;
    case "Queueing":
      return <IconMore fontSize={iconSize} style={{ color: "rgb(var(--warning-6))" }} />;
    case "Running":
      return <IconPlayCircle fontSize={iconSize} style={{ color: "rgb(var(--primary-5))" }} />;
    case "Pausing":
      return <IconPauseCircle fontSize={iconSize} style={{ color: "rgb(var(--warning-6))" }} />;
    case "Stopped":
      return <IconStop fontSize={iconSize} style={{ color: "rgb(var(--danger-6))" }} />;
    case "Finished":
      return <IconCheckCircle fontSize={iconSize} style={{ color: "rgb(var(--success-6))" }} />;
    case "Errored":
      return <IconCloseCircle fontSize={iconSize} style={{ color: "rgb(var(--danger-6))" }} />;
  }
}
