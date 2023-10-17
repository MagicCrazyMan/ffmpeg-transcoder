import { Table, TableColumnProps } from "@arco-design/web-react";
import { useSearchStore } from "../../store/search";
import { useMemo } from "react";
import { join } from "@tauri-apps/api/path";

type TableData = {
    input: string;
    output?: string;
}

export default function TargetTable() {
  const { files, isFileLoading } = useSearchStore();

  const tableCols: TableColumnProps[] = [
    {
      title: "Input",
      dataIndex: "absolute",
    },
    {
      title: "Output",
      dataIndex: "output",
    },
  ];

//   const tableData = useMemo(() => {
//     join;
//     return [], [files];
//   });

  return (
    <Table
      stripe
      size="mini"
      pagination={false}
      loading={isFileLoading}
      columns={tableCols}
      data={files}
    ></Table>
  );
}
