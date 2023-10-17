import { Button, Form, FormInstance, Input } from "@arco-design/web-react";
import { IconFolder } from "@arco-design/web-react/icon";
import { open } from "@tauri-apps/api/dialog";
import { useMemo, useRef } from "react";
import { useSearchStore } from "../../store/search";
import { DirectoryNotFoundError, toMessage } from "../../tauri/error";
import { getFilesFromDirectory } from "../../tauri/fs";
import { verifyDirectory } from "../../tauri/system";

/**
 * Input and Output directories input
 */
export default function Directories() {
  const { setFiles, setFileLoading, inputDir, outputDir, setInputDirectory, setOutputDirectory } =
    useSearchStore();

  const formRef = useRef<FormInstance<{ inputDir: string; outputDir: string }>>(null);
  const initialValues = useMemo(
    () =>
      ({
        inputDir: inputDir ?? "",
        outputDir: outputDir ?? "",
      }) as { inputDir: string; outputDir: string },
    [inputDir, outputDir]
  );

  const selectDirectory = async (type: "input" | "output") => {
    const dir = await open({
      title: type === "input" ? "Select Input Directory" : "Select Output Directory",
      directory: true,
    });

    if (dir) {
      type === "input"
        ? formRef.current?.setFieldValue("inputDir", dir as string)
        : formRef.current?.setFieldValue("outputDir", dir as string);
      onChange();
    }
  };

  const onChange = () => {
    formRef.current?.validate().then((values) => {
      setInputDirectory(values.inputDir);
      setOutputDirectory(values.outputDir);

      setFileLoading(true);
      setFiles([]);
      getFilesFromDirectory(values.inputDir)
        .then((files) => {
          setFiles(files);
        })
        .finally(() => {
          setFileLoading(false);
        });
    });
  };

  return (
    <Form
      size="mini"
      wrapperCol={{ span: 24 }}
      ref={formRef}
      initialValues={initialValues}
      onChange={onChange}
    >
      {/* Input Directory */}
      <Form.Item
        field="inputDir"
        rules={[
          {
            validator(value: string | undefined, callback) {
              if (!value) {
                return Promise.resolve(callback());
              } else {
                return verifyDirectory(value)
                  .then(() => {
                    callback();
                  })
                  .catch((err: DirectoryNotFoundError) => {
                    callback(toMessage(err));
                  });
              }
            },
          },
        ]}
      >
        <Input
          allowClear
          placeholder="Input Directory"
          beforeStyle={{ padding: "0" }}
          value={inputDir}
          onChange={setInputDirectory}
          addBefore={
            <Button
              type="text"
              icon={<IconFolder />}
              onClick={() => selectDirectory("input")}
            ></Button>
          }
        ></Input>
      </Form.Item>

      {/* Output Directory */}
      <Form.Item
        field="outputDir"
        extra={
          inputDir && outputDir && inputDir === outputDir
            ? "input & output directory point to same directory"
            : ""
        }
      >
        <Input
          allowClear
          placeholder="Output Directory"
          beforeStyle={{ padding: "0" }}
          value={outputDir}
          onChange={setOutputDirectory}
          addBefore={
            <Button
              type="text"
              icon={<IconFolder />}
              onClick={() => selectDirectory("output")}
            ></Button>
          }
        ></Input>
      </Form.Item>
    </Form>
  );
}
