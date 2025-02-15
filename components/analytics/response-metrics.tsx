"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ResponseMetricsProps {
  detailed?: boolean;
}

export default function ResponseMetrics({
  detailed = false,
}: ResponseMetricsProps) {
  const metrics = [
    {
      campaign: "SaaS Founders",
      sent: 450,
      responses: 85,
      responseRate: "18.9%",
      positiveResponses: 32,
      conversionRate: "37.6%",
    },
    {
      campaign: "Marketing Leaders",
      sent: 380,
      responses: 62,
      responseRate: "16.3%",
      positiveResponses: 28,
      conversionRate: "45.2%",
    },
    {
      campaign: "Startup CTOs",
      sent: 420,
      responses: 95,
      responseRate: "22.6%",
      positiveResponses: 45,
      conversionRate: "47.4%",
    },
  ];

  return (
    <Card className={detailed ? "col-span-2" : ""} data-oid="f7k.3ne">
      <CardHeader data-oid="o0-q-np">
        <CardTitle data-oid="-a_rc4t">Response Metrics</CardTitle>
      </CardHeader>
      <CardContent data-oid="8lkjsrs">
        <Table data-oid="aezgcjf">
          <TableHeader data-oid="__dm4eh">
            <TableRow data-oid="6-dqyn1">
              <TableHead data-oid="ijd_iv4">Campaign</TableHead>
              <TableHead className="text-right" data-oid="31n:gff">
                Sent
              </TableHead>
              <TableHead className="text-right" data-oid="m29bqvr">
                Responses
              </TableHead>
              <TableHead className="text-right" data-oid="qmqejir">
                Response Rate
              </TableHead>
              <TableHead className="text-right" data-oid="bsn9l71">
                Positive
              </TableHead>
              <TableHead className="text-right" data-oid="3-:4zgx">
                Conversion Rate
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody data-oid="kuqvnx:">
            {metrics.map((metric) => (
              <TableRow key={metric.campaign} data-oid="sh1_rv-">
                <TableCell data-oid="ff6fw10">{metric.campaign}</TableCell>
                <TableCell className="text-right" data-oid="cpt1wfa">
                  {metric.sent}
                </TableCell>
                <TableCell className="text-right" data-oid="qhz.hj_">
                  {metric.responses}
                </TableCell>
                <TableCell className="text-right" data-oid="czyhu:a">
                  {metric.responseRate}
                </TableCell>
                <TableCell className="text-right" data-oid="tlilshr">
                  {metric.positiveResponses}
                </TableCell>
                <TableCell className="text-right" data-oid="akm2o2x">
                  {metric.conversionRate}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}