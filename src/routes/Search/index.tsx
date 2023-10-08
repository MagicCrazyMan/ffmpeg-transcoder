import { Button, Divider, Table, TableColumnProps } from "@arco-design/web-react";
import { useEffect, useMemo, useState } from "react";
import { v4 } from "uuid";
import { useAppStore } from "../../store/app";
import { TargetFile } from "../../tauri/fs";
import DirectoryIO from "./DirectoryIO";
import ExtensionFilter from "./ExtensionFilter";
import RegularFilter from "./RegularFilter";
import { ExtensionFilterState, RegularFilterData } from "./constants";
import "./index.less";

/**
 * A page for searching files from a input directory
 * and constructing tasks.
 */
export default function SearchPage() {
  const join = useAppStore((state) => state.join);

  const [inputDirectory, setInputDirectory] = useState("");
  const [outputDirectory, setOutputDirectory] = useState("");
  const [inputFiles, setInputFiles] = useState<TargetFile[]>([]);

  const [extensionFilterState, setExtensionFilterState] = useState(ExtensionFilterState.Disabled);
  const [extensions, setExtensions] = useState<string[]>([]);

  const [regularFiltersEnabled, setRegularFiltersEnabled] = useState(true);
  const [regularFilters, setRegularFilters] = useState<RegularFilterData[]>([
    {
      id: v4(),
      value: "sdfsdfs",
      enabled: true,
      regex: true,
      blacklist: false,
      applyFile: true,
      applyDirectory: true,
    },
    {
      id: v4(),
      value: "sdfsfd",
      enabled: true,
      regex: true,
      blacklist: false,
      applyFile: true,
      applyDirectory: true,
    },
  ]);

  const tableCols: TableColumnProps[] = [
    {
      title: "Input",
      dataIndex: "input",
    },
    {
      title: "Output",
      dataIndex: "output",
    },
  ];
  const tableData = useMemo(() => {
    return inputFiles.map(({ absolute, relative }) => ({
      key: absolute,
      input: join(inputDirectory, relative),
      output: outputDirectory ? join(outputDirectory, relative) : "",
    }));
  }, [join, inputFiles, inputDirectory, outputDirectory]);

  useEffect(() => {
  }, [inputFiles]);

  useEffect(() => {
  }, [regularFilters]);

  return (
    <div className="container">
      {/* Input & Output Directories Selector */}
      <DirectoryIO
        className="io"
        inputDirectory={inputDirectory}
        onInputDirectoryChanged={setInputDirectory}
        outputDirectory={outputDirectory}
        onOutputDirectoryChanged={setOutputDirectory}
        onInputFilesChanged={setInputFiles}
      />

      {/* Divider */}
      <Divider className="divider mx-4" type="vertical" />

      {/* Files Filter */}
      <ExtensionFilter
        extensions={extensions}
        onExtensionsChanged={setExtensions}
        filterState={extensionFilterState}
        onFilterStateChanged={setExtensionFilterState}
        className="extension"
      />

      {/* Regular Filter */}
      <RegularFilter
        enabled={regularFiltersEnabled}
        onEnabled={setRegularFiltersEnabled}
        filters={regularFilters}
        onChanged={setRegularFilters}
        className="regular"
      ></RegularFilter>

      {/* Files Table */}
      <Table
        stripe
        pagination={false}
        className="table"
        columns={tableCols}
        data={tableData}
      ></Table>

      {/* Submit */}
      <Button type="primary" className="submit">
        Add to Queue
      </Button>
    </div>
  );
}
