"use client";
import { useState, useEffect } from "react";
import { Heading } from "@/components/heading";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Play, Pause, Pencil, Trash2, ArrowLeft, Check, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StepsNavigation } from "@/components/ui/steps-navigation";
import { useUser } from "@/contexts/user-context";

interface AutomatedLead {
  id: string;
  leadName: string;
  totalLeads: number;
  createdAt: string;
  followers: any[];
}

interface Campaign {
  id: number;
  name: string;
  progress: { sent: number; total: number };
  status: "Running" | "Paused";
}

interface TwitterAccount {
  id: string;
  twitterAccountName: string;
  createdAt: string;
  cookies: any[];
}

interface dmQueueList {
  id: string;
  messageSent: string;
  totalLeads: number;
  processedLeads: number;
  failedLeads: number;
  createdAt: string;
  campaignName: string;
}

export default function CampaignPage() {
  const [isCreating, setIsCreating] = useState(false);
  const [step, setStep] = useState(1);
  const [campaignName, setCampaignName] = useState("");
  const [messageTemplate, setMessageTemplate] = useState("");
  const [selectedLeadList, setSelectedLeadList] = useState<AutomatedLead | null>(null);
  const [messageVariants, setMessageVariants] = useState([
    { id: 1, content: "", isEnabled: true },
  ]);
  const [delay, setDelay] = useState("15");
  const [dailyLimit, setDailyLimit] = useState("50");
  const [selectedAccount, setSelectedAccount] = useState<TwitterAccount | null>(null);
  const [leadLists, setLeadLists] = useState<AutomatedLead[]>([]);
  const [loading, setLoading] = useState(true);
  const { userId } = useUser();
  const [twitterAccounts, setTwitterAccounts] = useState<TwitterAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dmqueueList, setDmqueueList] = useState<dmQueueList[]>([]);
  const [sendingDM, setSendingDM] = useState(false);
  const steps = [
    { title: "Select Source", subtitle: "Choose your campaign data source" },
    { title: "Write Message", subtitle: "Craft your campaign message" },
    { title: "Configure Variants", subtitle: "Set up message variations" },
    { title: "Start Automation", subtitle: "Review and launch campaign" },
  ];

  const sendDM = async () => {
    if (!selectedAccount?.cookies) {
      console.error("No cookies available");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const recipientIds = selectedLeadList?.followers.map((follower) => follower.id);

      // First, create a message record in the database
      const messageResponse = await fetch("/api/messages/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messageSent: messageTemplate,
          recipients: recipientIds,
          campaignName: campaignName,
          userId: userId
        }),
      });

      if (!messageResponse.ok) {
        throw new Error("Failed to create message record");
      }

      // Then start the DM sending process
      const response = await fetch("/api/send-DM", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "start",
          recipients: recipientIds,
          message: messageTemplate,
          cookies: selectedAccount?.cookies,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to start DM process");
      }

      const data = await response.json();
      console.log("DM process started:", data);
    } catch (error) {
      console.error("Failed to send DMs:", error);
      setError(error instanceof Error ? error.message : "Failed to send DMs");
    } finally {
      setLoading(false);
    }
  };

  // Fetch messages to show the queue processing
  useEffect(() => {
    const fetchMessages = async () => {
      if (!userId) return;

      try {
        const response = await fetch(`/api/messages?userId=${userId}`);
        const data = await response.json();

        if (response.ok) {
          // Transform the data to calculate the required metrics
          const transformedData: dmQueueList[] = data.messages.map(
            (message: any) => {
              const totalLeads = message.messages.length;
              const processedLeads = message.messages.filter(
                (m: any) => m.status === true,
              ).length;
              const failedLeads = message.messages.filter(
                (m: any) => m.status === false,
              ).length;

              return {
                id: message.id,
                messageSent: message.messageSent,
                totalLeads,
                processedLeads,
                failedLeads,
                createdAt: message.createdAt,
                campaignName: message.campaignName,
              };
            },
          );

          setDmqueueList(transformedData);
        }
      } catch (error) {
        console.error("Error fetching messages:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [userId]);

  useEffect(() => {
    const fetchLeadLists = async () => {
      if (!userId) return;
      
      try {
        const response = await fetch(`/api/leads?userId=${userId}`);
        if (!response.ok) throw new Error('Failed to fetch lead lists');
        
        const data = await response.json();
        setLeadLists(data.leads);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching lead lists:', error);
        setLoading(false);
      }
    };

    fetchLeadLists();
  }, [userId]);

  useEffect(() => {
    const fetchTwitterAccounts = async () => {
      if (!userId) return;
      
      try {
        const response = await fetch(`/api/twitter/get-accounts?userId=${userId}`);
        if (!response.ok) throw new Error('Failed to fetch Twitter accounts');
        
        const data = await response.json();
        setTwitterAccounts(data.accounts);
      } catch (error) {
        console.error('Error fetching Twitter accounts:', error);
      } finally {
        setAccountsLoading(false);
      }
    };

    fetchTwitterAccounts();
  }, [userId]);

  const addMessageVariant = () => {
    setMessageVariants([
      ...messageVariants,
      { id: messageVariants.length + 1, content: "", isEnabled: true },
    ]);
  };
  if (isCreating) {
    return (
      <div className="min-h-screen bg-gray-50">
        {" "}
        <div className="max-w-[90vw] mx-auto p-6">
          {" "}
          <Button
            variant="ghost"
            className="mb-6 gap-2"
            onClick={() => {
              setIsCreating(false);
              setStep(1);
            }}
          >
            {" "}
            <ArrowLeft className="h-5 w-5" /> Back{" "}
          </Button>{" "}
          <Card className="border-none shadow-lg">
            {" "}
            <StepsNavigation
              steps={steps}
              currentStep={step}
              onStepClick={(newStep) => {
                if (newStep <= step) {
                  setStep(newStep);
                }
              }}
            />{" "}
            <div className="p-8">
              {" "}
              {/* Step 1: Select Source */}{" "}
              {step === 1 && (
                <div className="max-w-[95%] mx-auto space-y-8">
                  {" "}
                  <h2 className="text-3xl font-medium text-center mb-8">
                    {" "}
                    Select Lead Source{" "}
                  </h2>{" "}
                  {loading ? (
                    <div className="text-center">Loading lead lists...</div>
                  ) : leadLists.length === 0 ? (
                    <div className="text-center space-y-4">
                      {" "}
                      <p className="text-gray-600">You do not have any lead lists yet.</p>{" "}
                      <Button 
                        variant="link" 
                        className="text-black underline hover:text-gray-700"
                        onClick={() => window.location.href = '/leads'}
                      >
                        {" "}
                        Create lead list in Find Leads →{" "}
                      </Button>{" "}
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-6">
                      {" "}
                      {leadLists.map((list) => (
                        <Card
                          key={list.id}
                          className={`border-2 p-6 cursor-pointer transition-all hover:shadow-lg ${
                            selectedLeadList?.id === list.id
                              ? "ring-2 ring-black border-black"
                              : "hover:border-gray-400"
                          }`}
                          onClick={() => setSelectedLeadList(list)}
                        >
                          {" "}
                          <h3 className="font-medium text-xl mb-2">
                            {list.leadName}
                          </h3>{" "}
                          <p className="text-gray-500">{list.totalLeads.toLocaleString()} leads</p>{" "}
                        </Card>
                      ))}{" "}
                    </div>
                  )}
                  <div className="flex justify-end">
                    {" "}
                    <Button
                      className="bg-black hover:bg-gray-800 text-white px-12 py-6 text-lg rounded-xl"
                      onClick={() => setStep(2)}
                      disabled={!selectedLeadList}
                    >
                      {" "}
                      Next{" "}
                    </Button>{" "}
                  </div>{" "}
                </div>
              )}{" "}
              {/* Step 2: Write Message */}{" "}
              {step === 2 && (
                <div className="max-w-[95%] mx-auto space-y-10">
                  {" "}
                  {/* Header Section */}{" "}
                  <div className="text-center space-y-4">
                    {" "}
                    <h2 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-purple-900 bg-clip-text text-transparent">
                      {" "}
                      Write Your Message{" "}
                    </h2>{" "}
                    <p className="text-gray-600 text-lg max-w-lg mx-auto">
                      {" "}
                      Craft a personalized message that resonates with your
                      audience{" "}
                    </p>{" "}
                  </div>{" "}
                  <div className="max-w-4xl mx-auto">
                    {" "}
                    <div className="grid grid-cols-5 gap-8">
                      {" "}
                      {/* Left Column - Context and Variables */}{" "}
                      <div className="col-span-2 space-y-6">
                        {" "}
                        {/* Context Section */}{" "}
                        <div className="space-y-4">
                          {" "}
                          <div className="flex items-center justify-between">
                            {" "}
                            <Label className="text-lg font-semibold text-gray-900">
                              Lead Context
                            </Label>{" "}
                            <span className="px-3 py-1 bg-purple-100 text-purple-600 rounded-full text-sm font-medium">
                              {" "}
                              Sample Lead{" "}
                            </span>{" "}
                          </div>{" "}
                          <Card className="border-2 rounded-xl p-6 hover:shadow-lg transition-all duration-300 bg-white">
                            {" "}
                            <div className="space-y-4">
                              {" "}
                              <div className="flex items-center gap-4">
                                {" "}
                                <div className="w-14 h-14 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full flex-shrink-0 flex items-center justify-center">
                                  {" "}
                                  <span className="text-2xl">👩🏻‍💻</span>{" "}
                                </div>{" "}
                                <div>
                                  {" "}
                                  <div className="font-semibold text-lg text-gray-900">
                                    Sarah Smith
                                  </div>{" "}
                                  <div className="text-purple-600 font-medium">
                                    @sarahsmith
                                  </div>{" "}
                                </div>{" "}
                              </div>{" "}
                              <div className="text-gray-700 leading-relaxed">
                                {" "}
                                Tech Founder | SaaS Expert | Building the future
                                of work | Previously @bigtech{" "}
                              </div>{" "}
                              <div className="flex items-center gap-6 text-gray-600">
                                {" "}
                                <div className="flex items-center gap-2">
                                  {" "}
                                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>{" "}
                                  <span>12.5k followers</span>{" "}
                                </div>{" "}
                                <div className="flex items-center gap-2">
                                  {" "}
                                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>{" "}
                                  <span>1.1k following</span>{" "}
                                </div>{" "}
                              </div>{" "}
                            </div>{" "}
                          </Card>{" "}
                        </div>{" "}
                        {/* Variables Section */}{" "}
                        <div className="space-y-4">
                          {" "}
                          <Label className="text-lg font-semibold text-gray-900">
                            Available Variables
                          </Label>{" "}
                          <div className="grid grid-cols-2 gap-3">
                            {" "}
                            {[
                              { name: "{name}", desc: "Full Name" },
                              { name: "{username}", desc: "Twitter Handle" },
                              { name: "{followers}", desc: "Follower Count" },
                              { name: "{bio}", desc: "Bio Excerpt" },
                            ].map((variable) => (
                              <div
                                key={variable.name}
                                className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-purple-300 cursor-pointer transition-all"
                                onClick={() => {
                                  const textarea =
                                    document.querySelector("textarea");
                                  if (textarea) {
                                    const start = textarea.selectionStart;
                                    const end = textarea.selectionEnd;
                                    const newValue =
                                      messageTemplate.substring(0, start) +
                                      variable.name +
                                      messageTemplate.substring(end);
                                    setMessageTemplate(newValue);
                                  }
                                }}
                              >
                                {" "}
                                <div className="font-mono text-purple-600">
                                  {variable.name}
                                </div>{" "}
                                <div className="text-sm text-gray-600">
                                  {variable.desc}
                                </div>{" "}
                              </div>
                            ))}{" "}
                          </div>{" "}
                        </div>{" "}
                      </div>{" "}
                      {/* Right Column - Message Editor and Preview */}{" "}
                      <div className="col-span-3 space-y-6">
                        {" "}
                        {/* Message Template Section */}{" "}
                        <div className="space-y-4">
                          {" "}
                          <div className="flex items-center justify-between">
                            {" "}
                            <Label className="text-lg font-semibold text-gray-900">
                              Message Template
                            </Label>{" "}
                            <div className="flex items-center gap-2">
                              {" "}
                              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                                {" "}
                                <span className="text-xl">✨</span>{" "}
                              </button>{" "}
                              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                                {" "}
                                <span className="text-xl">🎯</span>{" "}
                              </button>{" "}
                            </div>{" "}
                          </div>{" "}
                          <div className="relative">
                            {" "}
                            <Textarea
                              placeholder="Hi {name}, I noticed you're..."
                              value={messageTemplate}
                              onChange={(e) =>
                                setMessageTemplate(e.target.value)
                              }
                              className="min-h-[200px] text-base border-2 rounded-xl resize-none p-4 shadow-sm focus:border-purple-400 focus:ring-purple-200"
                            />{" "}
                            <div className="absolute bottom-4 right-4 text-sm text-gray-400">
                              {" "}
                              {messageTemplate.length} characters{" "}
                            </div>{" "}
                          </div>{" "}
                        </div>{" "}
                        {/* Preview Section */}{" "}
                        <div className="space-y-4">
                          {" "}
                          <div className="flex items-center justify-between">
                            {" "}
                            <Label className="text-lg font-semibold text-gray-900">
                              Live Preview
                            </Label>{" "}
                            <span className="px-3 py-1 bg-green-100 text-green-600 rounded-full text-sm font-medium">
                              {" "}
                              Looking Good! 👍{" "}
                            </span>{" "}
                          </div>{" "}
                          <Card className="border-2 rounded-xl p-6 bg-gradient-to-br from-gray-50 to-white shadow-sm">
                            {" "}
                            <div className="text-gray-700 leading-relaxed">
                              {" "}
                              {messageTemplate
                                .replace("{name}", "Sarah")
                                .replace("{username}", "@sarahsmith")
                                .replace("{followers}", "12.5k")
                                .replace(
                                  "{bio}",
                                  "Tech Founder | SaaS Expert",
                                )}{" "}
                            </div>{" "}
                          </Card>{" "}
                        </div>{" "}
                      </div>{" "}
                    </div>{" "}
                    {/* Navigation Buttons */}{" "}
                    <div className="flex justify-end gap-4 mt-8">
                      {" "}
                      <Button
                        variant="outline"
                        className="px-8 py-3 hover:bg-gray-50 transition-colors duration-300"
                        onClick={() => setStep(1)}
                      >
                        {" "}
                        Back{" "}
                      </Button>{" "}
                      <Button
                        className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:hover:shadow-lg"
                        onClick={() => setStep(3)}
                        disabled={!messageTemplate}
                      >
                        {" "}
                        Continue to Variants{" "}
                      </Button>{" "}
                    </div>{" "}
                  </div>{" "}
                </div>
              )}{" "}
              {/* Step 3: Configure Variants */}{" "}
              {step === 3 && (
                <div className="max-w-[95%] mx-auto space-y-8">
                  {" "}
                  <div className="grid grid-cols-2 gap-8">
                    {" "}
                    {/* Left Column - Generate Ideas */}{" "}
                    <div className="space-y-6">
                      {" "}
                      <div className="bg-[#111827] rounded-lg p-6">
                        {" "}
                        <div className="flex justify-between items-center mb-6">
                          {" "}
                          <h3 className="text-xl text-gray-300">
                            {" "}
                            Generate Ideas{" "}
                          </h3>{" "}
                          <Button className="bg-[#1F2937] hover:bg-[#374151] text-white gap-2">
                            {" "}
                            <span className="text-lg">⚡</span> Generate{" "}
                          </Button>{" "}
                        </div>{" "}
                        <div className="flex flex-col items-center justify-center py-20 text-center space-y-2">
                          {" "}
                          <div className="w-12 h-12 bg-[#1F2937] rounded-lg flex items-center justify-center mb-4">
                            {" "}
                            🧪{" "}
                          </div>{" "}
                          <h4 className="text-lg font-medium text-gray-300">
                            {" "}
                            Generate Variant Ideas{" "}
                          </h4>{" "}
                          <p className="text-gray-400 text-sm">
                            {" "}
                            Click the generate button <br /> create some variant
                            ideas <br /> with AI{" "}
                          </p>{" "}
                        </div>{" "}
                      </div>{" "}
                    </div>{" "}
                    {/* Right Column - Selected Message Variants */}{" "}
                    <div className="space-y-6">
                      {" "}
                      <div className="bg-[#111827] rounded-lg p-6">
                        {" "}
                        <div className="space-y-4">
                          {" "}
                          <div className="flex justify-between items-start">
                            {" "}
                            <div>
                              {" "}
                              <h3 className="text-xl text-gray-300 mb-1">
                                {" "}
                                Selected Message Variants{" "}
                              </h3>{" "}
                              <p className="text-sm text-gray-400">
                                {" "}
                                We recommend adding 5 or more variants.{" "}
                              </p>{" "}
                              <p className="text-sm text-gray-400 mt-1">
                                {" "}
                                Pro tip: Add spintax to your variants for even
                                more randomization.{" "}
                              </p>{" "}
                            </div>{" "}
                          </div>{" "}
                          {/* Primary Variant */}{" "}
                          <div className="space-y-4 mt-6">
                            {" "}
                            <div className="space-y-2">
                              {" "}
                              <Label className="text-gray-300">
                                {" "}
                                Primary Variant{" "}
                              </Label>{" "}
                              <Textarea
                                value={messageTemplate}
                                onChange={(e) =>
                                  setMessageTemplate(e.target.value)
                                }
                                className="min-h-[120px] bg-[#1F2937] border-0 text-gray-300 resize-none"
                                placeholder="Hey [First Name]!"
                              />{" "}
                            </div>{" "}
                            {/* Variant Messages */}{" "}
                            {messageVariants.map((variant, index) => (
                              <div key={variant.id} className="space-y-2">
                                {" "}
                                <div className="flex justify-between items-center">
                                  {" "}
                                  <Label className="text-gray-300">
                                    {" "}
                                    Variant Idea {index + 1}{" "}
                                  </Label>{" "}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-gray-400 hover:text-gray-300"
                                    onClick={() => {
                                      const newVariants =
                                        messageVariants.filter(
                                          (v) => v.id !== variant.id,
                                        );
                                      setMessageVariants(newVariants);
                                    }}
                                  >
                                    {" "}
                                    Delete{" "}
                                  </Button>{" "}
                                </div>{" "}
                                <Textarea
                                  value={variant.content}
                                  onChange={(e) => {
                                    const newVariants = [...messageVariants];
                                    newVariants[index].content = e.target.value;
                                    setMessageVariants(newVariants);
                                  }}
                                  className="min-h-[120px] bg-[#1F2937] border-0 text-gray-300 resize-none"
                                  placeholder="Write your variant here..."
                                />{" "}
                              </div>
                            ))}{" "}
                            {/* Add Variant Button */}{" "}
                            <Button
                              variant="outline"
                              className="w-full py-4 text-gray-300 border-gray-600 hover:bg-[#1F2937]"
                              onClick={addMessageVariant}
                            >
                              {" "}
                              + Add Variant{" "}
                            </Button>{" "}
                          </div>{" "}
                        </div>{" "}
                      </div>{" "}
                      {/* Navigation Buttons */}{" "}
                      <div className="flex justify-end gap-4">
                        {" "}
                        <Button
                          variant="outline"
                          className="text-gray-300 border-gray-600 hover:bg-[#1F2937]"
                          onClick={() => setStep(2)}
                        >
                          {" "}
                          Skip{" "}
                        </Button>{" "}
                        <Button
                          className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-8"
                          onClick={() => setStep(4)}
                          disabled={
                            !messageTemplate &&
                            messageVariants.every((v) => !v.content)
                          }
                        >
                          {" "}
                          Next{" "}
                        </Button>{" "}
                      </div>{" "}
                    </div>{" "}
                  </div>{" "}
                </div>
              )}{" "}
              {/* Step 4: Start Automation */}{" "}
              {step === 4 && (
                <div className="max-w-[95%] mx-auto space-y-8">
                  {" "}
                  <h2 className="text-3xl font-medium text-center mb-8">
                    {" "}
                    Configure Automation{" "}
                  </h2>{" "}
                  <div className="max-w-2xl mx-auto space-y-8">
                    {" "}
                    <Card className="border-2 p-6">
                      {" "}
                      <div className="space-y-6">
                        {" "}
                        <div className="space-y-4">
                          {" "}
                          <Label className="text-lg">Campaign Name</Label>
                          <Input
                            placeholder="Enter campaign name"
                            value={campaignName}
                            onChange={(e) => setCampaignName(e.target.value)}
                            className="border-2"
                          />{" "}
                        </div>{" "}
                        <div className="space-y-4">
                          {" "}
                          <Label className="text-lg">Select Twitter Account</Label>
                          <div className="grid gap-4">
                            {accountsLoading ? (
                              <div className="text-center py-4 text-gray-500">Loading accounts...</div>
                            ) : twitterAccounts.length === 0 ? (
                              <div className="text-center py-4 text-gray-500">
                                No Twitter accounts connected. 
                                <Button 
                                  variant="link" 
                                  className="text-black underline hover:text-gray-700"
                                  onClick={() => window.location.href = '/settings'}
                                >
                                  Connect an account →
                                </Button>
                              </div>
                            ) : (
                              twitterAccounts.map((account) => (
                                <div
                                  key={account.id}
                                  className={`flex items-center justify-between p-4 border-2 rounded-lg cursor-pointer hover:border-gray-400 transition-all ${
                                    selectedAccount?.id === account.id ? 'border-black bg-gray-50' : 'border-gray-200'
                                  }`}
                                  onClick={() => setSelectedAccount(account)}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-xl">
                                      👤
                                    </div>
                                    <div>
                                      <div className="font-medium">@{account.twitterAccountName}</div>
                                      <div className="text-sm text-gray-500">Connected</div>
                                    </div>
                                  </div>
                                  {selectedAccount?.id === account.id && (
                                    <div className="w-6 h-6 bg-black rounded-full flex items-center justify-center">
                                      <Check className="w-4 h-4 text-white" />
                                    </div>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        <div className="space-y-4">
                          {" "}
                          <Label className="text-lg">Daily message limit</Label>
                          <Select value={dailyLimit} onValueChange={setDailyLimit}>
                            {" "}
                            <SelectTrigger>
                              {" "}
                              <SelectValue />{" "}
                            </SelectTrigger>{" "}
                            <SelectContent>
                              {" "}
                              <SelectItem value="50">50 messages</SelectItem>{" "}
                              <SelectItem value="100">100 messages</SelectItem>{" "}
                              <SelectItem value="150">150 messages</SelectItem>{" "}
                            </SelectContent>{" "}
                          </Select>{" "}
                        </div>{" "}
                      </div>{" "}
                    </Card>{" "}
                    <div className="flex justify-end gap-4">
                      {" "}
                      <Button
                        variant="outline"
                        className="px-8 py-6 text-lg"
                        onClick={() => setStep(3)}
                      >
                        {" "}
                        Back{" "}
                      </Button>{" "}
                      <Button
                        className="bg-black hover:bg-gray-800 text-white px-12 py-6 text-lg rounded-xl"
                        onClick={async () => {
                          setSendingDM(true);
                          try {
                            await sendDM();
                            setIsCreating(false);
                            setStep(1);
                          } finally {
                            setSendingDM(false);
                          }
                        }}
                        disabled={!campaignName || !selectedAccount || !selectedLeadList || sendingDM}
                      >
                        {sendingDM ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Starting Campaign...
                          </>
                        ) : (
                          'Start Campaign'
                        )}
                      </Button>{" "}
                    </div>{" "}
                  </div>{" "}
                </div>
              )}{" "}
            </div>{" "}
          </Card>{" "}
        </div>{" "}
      </div>
    );
  }
  return (
    <div className="p-8 space-y-8">
      {" "}
      <div className="flex justify-between items-center">
        {" "}
        <Heading
          title="Campaign"
          description="View and manage your message campaigns"
        />{" "}
        <Button
          className="border-2"
          variant="outline"
          onClick={() => setIsCreating(true)}
        >
          {" "}
          Create new Campaign{" "}
        </Button>{" "}
      </div>{" "}
      <div className="space-y-6">
        {" "}
        {dmqueueList.map((queue) => (
          <Card key={queue.id} className="p-6 border-2">
            <div className="space-y-6">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <h3 className="text-xl font-medium">{queue.campaignName}</h3>
                  <p className="text-sm text-gray-500">
                    Progress - {queue.processedLeads}/{queue.totalLeads} sent 
                    {queue.failedLeads > 0 && ` (${queue.failedLeads} failed)`}
                  </p>
                </div>
                <div className="text-sm text-gray-500">
                  Status - {queue.processedLeads === queue.totalLeads ? 'Completed' : 'In Progress'}
                </div>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5">
                <div
                  className="bg-[#0F172A] h-2.5 rounded-full"
                  style={{
                    width: `${(queue.processedLeads / queue.totalLeads) * 100}%`,
                  }}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" className="border-2">
                  {queue.processedLeads === queue.totalLeads ? (
                    <>
                      <Play className="h-4 w-4 mr-2" /> Retry Failed
                    </>
                  ) : (
                    <>
                      <Pause className="h-4 w-4 mr-2" /> Pause
                    </>
                  )}
                </Button>
                <Button variant="outline" className="border-2">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>{" "}
    </div>
  );
}
