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

export default function Progress({ task }: { task: Task }) {
  switch (task.state.type) {
    case "Idle":
      return <IconRecordStop fontSize="24px" />;
    case "Commanding":
      return <Spin size={24}></Spin>;
    case "Queueing":
      return <IconMore fontSize="24px" style={{ color: "rgb(var(--warning-6))" }} />;
    case "Running":
      return <IconPlayCircle fontSize="24px" style={{ color: "rgb(var(--primary-5))" }} />;
    case "Pausing":
      return <IconPauseCircle fontSize="24px" style={{ color: "rgb(var(--warning-6))" }} />;
    case "Stopped":
      return <IconStop fontSize="24px" style={{ color: "rgb(var(--danger-6))" }} />;
    case "Finished":
      return <IconCheckCircle fontSize="24px" style={{ color: "rgb(var(--success-6))" }} />;
    case "Errored":
      return <IconCloseCircle fontSize="24px" style={{ color: "rgb(var(--danger-6))" }} />;
  }
}
