import { json } from "@remix-run/node";
import { useLoaderData, Link, useNavigate } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import {
  Card,
  EmptyState,
  Layout,
  Page,
  IndexTable,
  Thumbnail,
  Text,
  Icon,
  InlineStack,
  useSetIndexFiltersMode,
  IndexFilters
} from "@shopify/polaris";
import { getQRCodes, getQRCodesLength } from "../models/QRCode.server";
import { DiamondAlertMajor, ImageMajor } from "@shopify/polaris-icons";
import { useState, useCallback, useRef } from 'react';

export async function loader({ request }) {
  const url = new URL(request.url);
  const start = Number(url.searchParams.get('start')) || 0;
  const end = start + 5;
  const query = url.searchParams.get('key') || "";
  const { admin, session } = await authenticate.admin(request);
  const qrCodes = await getQRCodes(session.shop, admin.graphql, start, end, query);
  const qrCodesLength = await getQRCodesLength(session.shop, query)

  return json({
    qrCodes,
    start,
    qrCodesLength,
    query
  });
}

const EmptyQRCodeState = ({ onAction }) => (
  <EmptyState
    heading="Create unique QR codes for your product"
    action={{
      content: "Create QR code",
      onAction,
    }}
    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
  >
    <p>Allow customers to scan codes and buy products using their phones.</p>
  </EmptyState>
);

function truncate(str, { length = 25 } = {}) {
  if (!str) return "";
  if (str.length <= length) return str;
  return str.slice(0, length) + "…";
}

const QRTable = ({ qrCodes, start, navigate, qrCodesLength, query }) => (
  <>
    {console.log(query)}
    <IndexTable
      resourceName={{
        singular: "QR code",
        plural: "QR codes",
      }}
      itemCount={qrCodes.length}
      headings={[
        { title: "Thumbnail", hidden: true },
        { title: "Title" },
        { title: "Product" },
        { title: "Date created" },
        { title: "Scans" },
      ]}
      selectable={false}
      pagination={{
        hasPrevious: start == 0 ? false : true,
        onPrevious: () => {
          navigate(`/app/?start=${start - 5}${query !== '' ? `&key=${query}` : ''}`)
        },
        hasNext: false,
        hasNext: qrCodesLength - start <= 5 ? false : true,
        onNext: () => {
          navigate(`/app/?start=${start + 5}${query !== '' ? `&key=${query}` : ''}`)
        },
      }}
    >
      {qrCodes.map((qrCode) => (
        <QRTableRow key={qrCode.id} qrCode={qrCode} />
      ))}
    </IndexTable>
  </>

);



const QRTableRow = ({ qrCode }) => (
  <IndexTable.Row id={qrCode.id} position={qrCode.id} >
    <IndexTable.Cell>
      <Thumbnail
        source={qrCode.productImage || ImageMajor}
        alt={qrCode.productTitle}
        size="small"
      />
    </IndexTable.Cell>
    <IndexTable.Cell>
      <Link to={`qrcodes/${qrCode.id}`}>{truncate(qrCode.title)}</Link>
    </IndexTable.Cell>
    <IndexTable.Cell>
      {qrCode.productDeleted ? (
        <InlineStack align="start" gap="200">
          <span style={{ width: "20px" }}>
            <Icon source={DiamondAlertMajor} tone="critical" />
          </span>
          <Text tone="critical" as="span">
            product has been deleted
          </Text>
        </InlineStack>
      ) : (
        truncate(qrCode.productTitle)
      )}
    </IndexTable.Cell>
    <IndexTable.Cell>
      {new Date(qrCode.createdAt).toDateString()}
    </IndexTable.Cell>
    <IndexTable.Cell>{qrCode.scans}</IndexTable.Cell>
  </IndexTable.Row>
);



export default function Index() {
  const { qrCodes, start, qrCodesLength, query } = useLoaderData();
  const navigate = useNavigate();
  const [queryValue, setQueryValue] = useState("");
  const typingTimeout = useRef(null)

  const handleFiltersQueryChange = useCallback(
    (value) => {
      setQueryValue(value)

      if (typingTimeout.current) {
        clearTimeout(typingTimeout.current)
      }

      typingTimeout.current = setTimeout(() => {
        navigate(`/app?key=` + value);
      }, 2000)
    },
    []
  );

  const onHandleCancel = () => { };
  const [itemStrings, setItemStrings] = useState([
  ]);
  const tabs = itemStrings.map((item, index) => ({
    content: item,
    index,
    onAction: () => { },
    id: `${item}-${index}`,
    isLocked: index === 0,
    actions:
      index === 0
        ? []
        : [
          {
            type: "rename",
            onAction: () => { },
            onPrimaryAction: async (value) => {
              const newItemsStrings = tabs.map((item, idx) => {
                if (idx === index) {
                  return value;
                }
                return item.content;
              });
              await sleep(1);
              setItemStrings(newItemsStrings);
              return true;
            },
          },
          {
            type: "duplicate",
            onPrimaryAction: async (value) => {
              await sleep(1);
              duplicateView(value);
              return true;
            },
          },
          {
            type: "edit",
          },
          {
            type: "delete",
            onPrimaryAction: async () => {
              await sleep(1);
              deleteView(index);
              return true;
            },
          },
        ],
  }));

  const filters = [
  ];
  const { mode, setMode } = useSetIndexFiltersMode();

  return (
    <Page>
      <ui-title-bar title="QR codes">
        <button variant="primary" onClick={() => navigate("/app/qrcodes/new")}>
          Create QR code
        </button>
      </ui-title-bar>
      <Layout>
        <Layout.Section>
          <Card padding="0">
            {qrCodes.length === 0 && query.length === 0 ? (
              <EmptyQRCodeState onAction={() => navigate("qrcodes/new")} />
            ) : (
              <>
                <IndexFilters
                  queryValue={queryValue}
                  queryPlaceholder="Searching in all"
                  onQueryChange={handleFiltersQueryChange}
                  onQueryClear={() => setQueryValue("")}
                  cancelAction={{
                    onAction: onHandleCancel,
                    disabled: false,
                    loading: false,
                  }}
                  tabs={tabs}
                  filters={filters}
                  mode={mode}
                  setMode={setMode}
                />

                <QRTable
                  qrCodes={qrCodes}
                  start={start}
                  query={query}
                  navigate={navigate}
                  qrCodesLength={qrCodesLength}
                />
              </>
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
