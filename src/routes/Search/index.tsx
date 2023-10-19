import { Button } from "@arco-design/web-react";
import { sep } from "@tauri-apps/api/path";
import { useNavigate } from "react-router-dom";
import { usePresetStore } from "../../store/preset";
import { useSearchStore } from "../../store/search";
import { TaskInputParams, TaskOutputParams, TaskParams, useTaskStore } from "../../store/task";
import { toTaskParams } from "../../utils";
import Directories from "./Directories";
import ExtensionFilter from "./ExtensionFilter";
import RegularFilters from "./RegularFilters";
import SearchFileTable from "./SearchFileTable";
import "./index.less";

/**
 * A page for searching files from a input directory
 * and adding multiple task from them
 */
export default function SearchPage() {
  const navigate = useNavigate();
  const {
    outputDir,
    nodeMap,
    inputParamsMap,
    outputParamsMap,
    selectedRowKeys,
    setSelectedRowKeys,
  } = useSearchStore();
  const { addTasks } = useTaskStore();
  const { presets } = usePresetStore();

  const onAddTasks = () => {
    const taskParams = selectedRowKeys.reduce((taskParams, key) => {
      const fileNode = nodeMap.get(key);
      if (!fileNode || fileNode.type !== "File") return taskParams;

      const inputParams = inputParamsMap.get(fileNode.inputId);
      if (!inputParams) return taskParams;
      const outputParams = outputParamsMap.get(fileNode.outputId);
      if (!outputParams) return taskParams;

      taskParams.push({
        inputs: [
          toTaskParams(
            {
              ...inputParams,
              path: fileNode.absolute,
            },
            presets
          ) as TaskInputParams,
        ],
        outputs: [
          toTaskParams(
            {
              ...outputParams,
              path: [
                outputDir,
                ...fileNode.relative_components,
                `${fileNode.stem ?? ""}${fileNode.extension ? `.${fileNode.extension}` : ""}`,
              ].join(sep),
            },
            presets
          ) as TaskOutputParams,
        ],
      });

      return taskParams;
    }, [] as TaskParams[]);

    addTasks(...taskParams);
    setSelectedRowKeys([]);
    navigate("/tasks");
  };

  return (
    <div className="container p-4 box-border h-screen flex basis-full flex-col">
      {/* Input & Output Directories Selector */}
      <Directories />

      <div className="flex-1 overflow-y-hidden flex">
        <div className="mr-4 basis-96 flex flex-col">
          {/* Extensions Filter */}
          <ExtensionFilter />

          {/* Regular Filters */}
          <div className="flex-1 overflow-y-hidden">
            <RegularFilters />
          </div>

          {/* Submit */}
          <Button
            type="primary"
            className="submit"
            disabled={selectedRowKeys.length === 0}
            onClick={onAddTasks}
          >
            Add Tasks
          </Button>
        </div>

        {/* Files Table */}
        <div className="flex-1">
          <SearchFileTable />
        </div>
      </div>
    </div>
  );
}
