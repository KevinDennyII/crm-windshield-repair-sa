import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Search,
  User,
  Phone,
  Mail,
  MapPin,
  Building2,
  Plus,
  RefreshCw,
  MessageSquare,
  Calendar,
  FileText,
  ChevronRight,
  Image as ImageIcon,
  Briefcase,
  Truck,
  Users,
  Package,
  MoreHorizontal,
  Edit,
  Trash2,
  Car,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { type Contact, type Job, contactCategories } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const contactFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phone: z.string().min(1, "Phone is required"),
  email: z.string().email("Valid email required").optional().or(z.literal("")),
  streetAddress: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  category: z.enum(contactCategories).default("customer"),
  isBusiness: z.boolean().default(false),
  businessName: z.string().optional(),
  notes: z.string().optional(),
});

type ContactFormData = z.infer<typeof contactFormSchema>;

const categoryIcons: Record<string, typeof User> = {
  customer: User,
  dealer: Car,
  fleet: Truck,
  subcontractor: Users,
  vendor: Package,
  other: MoreHorizontal,
};

const categoryColors: Record<string, string> = {
  customer: "bg-blue-500/10 text-blue-500",
  dealer: "bg-purple-500/10 text-purple-500",
  fleet: "bg-green-500/10 text-green-500",
  subcontractor: "bg-orange-500/10 text-orange-500",
  vendor: "bg-cyan-500/10 text-cyan-500",
  other: "bg-gray-500/10 text-gray-500",
};

function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11 && cleaned[0] === "1") {
    return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}

export default function Contacts() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [activeTab, setActiveTab] = useState("details");
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const { data: contacts, isLoading: loadingContacts, refetch: refetchContacts } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });

  const { data: contactJobs, isLoading: loadingJobs } = useQuery<Job[]>({
    queryKey: ["/api/contacts", selectedContact?.id, "jobs"],
    queryFn: async () => {
      if (!selectedContact?.id) return [];
      const res = await fetch(`/api/contacts/${selectedContact.id}/jobs`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch jobs");
      return res.json();
    },
    enabled: !!selectedContact?.id,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/contacts/sync-from-jobs");
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Success", description: data.message });
      refetchContacts();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to sync contacts", variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ContactFormData) => {
      const res = await apiRequest("POST", "/api/contacts", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Contact created successfully" });
      refetchContacts();
      setIsAddingContact(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create contact", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ContactFormData> }) => {
      const res = await apiRequest("PATCH", `/api/contacts/${id}`, data);
      return res.json();
    },
    onSuccess: (updatedContact: Contact) => {
      toast({ title: "Success", description: "Contact updated successfully" });
      refetchContacts();
      setSelectedContact(updatedContact);
      setIsEditing(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update contact", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/contacts/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Contact deleted successfully" });
      refetchContacts();
      setSelectedContact(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete contact", variant: "destructive" });
    },
  });

  const filteredContacts = (contacts || []).filter((contact) => {
    const matchesSearch = 
      `${contact.firstName} ${contact.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.phone.includes(searchQuery) ||
      (contact.email && contact.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (contact.businessName && contact.businessName.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = filterCategory === "all" || contact.category === filterCategory;
    
    return matchesSearch && matchesCategory;
  });

  const groupedContacts = filteredContacts.reduce((acc, contact) => {
    const firstLetter = (contact.lastName || contact.firstName || "#")[0].toUpperCase();
    if (!acc[firstLetter]) acc[firstLetter] = [];
    acc[firstLetter].push(contact);
    return acc;
  }, {} as Record<string, Contact[]>);

  const sortedLetters = Object.keys(groupedContacts).sort();

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <h1 className="text-2xl font-bold" data-testid="page-title">Contacts</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            data-testid="button-sync-contacts"
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", syncMutation.isPending && "animate-spin")} />
            Sync from Jobs
          </Button>
          <Dialog open={isAddingContact} onOpenChange={setIsAddingContact}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-add-contact">
                <Plus className="h-4 w-4 mr-2" />
                Add Contact
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add New Contact</DialogTitle>
                <DialogDescription>Create a new contact in your directory.</DialogDescription>
              </DialogHeader>
              <ContactForm 
                onSubmit={(data) => createMutation.mutate(data)} 
                isPending={createMutation.isPending}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-[350px] border-r flex flex-col bg-sidebar">
          <div className="p-3 border-b space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-contacts"
              />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger data-testid="select-filter-category">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {contactCategories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ScrollArea className="flex-1">
            {loadingContacts ? (
              <div className="p-4 text-center text-muted-foreground">Loading contacts...</div>
            ) : filteredContacts.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                {searchQuery || filterCategory !== "all" 
                  ? "No contacts match your filters" 
                  : "No contacts yet. Sync from jobs or add manually."}
              </div>
            ) : (
              <div className="p-2">
                {sortedLetters.map((letter) => (
                  <div key={letter}>
                    <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50 sticky top-0">
                      {letter}
                    </div>
                    {groupedContacts[letter].map((contact) => {
                      const CategoryIcon = categoryIcons[contact.category || "customer"];
                      return (
                        <button
                          key={contact.id}
                          onClick={() => {
                            setSelectedContact(contact);
                            setActiveTab("details");
                          }}
                          className={cn(
                            "w-full flex items-center gap-3 p-3 rounded-md text-left hover-elevate",
                            selectedContact?.id === contact.id && "bg-accent"
                          )}
                          data-testid={`contact-item-${contact.id}`}
                        >
                          <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", categoryColors[contact.category || "customer"])}>
                            <CategoryIcon className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">
                              {contact.businessName || `${contact.firstName} ${contact.lastName}`}
                            </div>
                            <div className="text-sm text-muted-foreground truncate">
                              {formatPhoneNumber(contact.phone)}
                            </div>
                          </div>
                          {contact.autoSynced && (
                            <Badge variant="outline" className="text-xs shrink-0">Synced</Badge>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          
          <div className="p-3 border-t text-sm text-muted-foreground">
            {filteredContacts.length} contact{filteredContacts.length !== 1 ? "s" : ""}
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedContact ? (
            <>
              <div className="p-4 border-b flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={cn("w-14 h-14 rounded-full flex items-center justify-center", categoryColors[selectedContact.category || "customer"])}>
                    {(() => {
                      const Icon = categoryIcons[selectedContact.category || "customer"];
                      return <Icon className="h-7 w-7" />;
                    })()}
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold" data-testid="contact-name">
                      {selectedContact.businessName || `${selectedContact.firstName} ${selectedContact.lastName}`}
                    </h2>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Badge variant="outline" className="capitalize">{selectedContact.category}</Badge>
                      {selectedContact.autoSynced && <Badge variant="secondary">Auto-Synced</Badge>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    onClick={() => window.open(`tel:${selectedContact.phone}`, "_blank")}
                    data-testid="button-call-contact"
                  >
                    <Phone className="h-4 w-4" />
                  </Button>
                  {selectedContact.email && (
                    <Button 
                      size="icon" 
                      variant="ghost"
                      onClick={() => window.open(`mailto:${selectedContact.email}`, "_blank")}
                      data-testid="button-email-contact"
                    >
                      <Mail className="h-4 w-4" />
                    </Button>
                  )}
                  <Button 
                    size="icon" 
                    variant="ghost"
                    onClick={() => setIsEditing(true)}
                    data-testid="button-edit-contact"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="icon" 
                    variant="ghost"
                    onClick={() => {
                      if (confirm("Are you sure you want to delete this contact?")) {
                        deleteMutation.mutate(selectedContact.id);
                      }
                    }}
                    data-testid="button-delete-contact"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                <TabsList className="mx-4 mt-2 w-fit">
                  <TabsTrigger value="details" data-testid="tab-details">
                    <User className="h-4 w-4 mr-2" />
                    Details
                  </TabsTrigger>
                  <TabsTrigger value="jobs" data-testid="tab-jobs">
                    <Briefcase className="h-4 w-4 mr-2" />
                    Jobs
                  </TabsTrigger>
                  <TabsTrigger value="documents" data-testid="tab-documents">
                    <FileText className="h-4 w-4 mr-2" />
                    Documents
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="flex-1 overflow-auto p-4 mt-0">
                  <ContactDetails contact={selectedContact} />
                </TabsContent>

                <TabsContent value="jobs" className="flex-1 overflow-auto p-4 mt-0">
                  <ContactJobs jobs={contactJobs} isLoading={loadingJobs} />
                </TabsContent>

                <TabsContent value="documents" className="flex-1 overflow-auto p-4 mt-0">
                  <ContactDocuments jobs={contactJobs} isLoading={loadingJobs} />
                </TabsContent>
              </Tabs>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Select a contact to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
            <DialogDescription>Update contact information.</DialogDescription>
          </DialogHeader>
          {selectedContact && (
            <ContactForm 
              contact={selectedContact}
              onSubmit={(data) => updateMutation.mutate({ id: selectedContact.id, data })} 
              isPending={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ContactForm({ 
  contact, 
  onSubmit, 
  isPending 
}: { 
  contact?: Contact; 
  onSubmit: (data: ContactFormData) => void; 
  isPending: boolean;
}) {
  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      firstName: contact?.firstName || "",
      lastName: contact?.lastName || "",
      phone: contact?.phone || "",
      email: contact?.email || "",
      streetAddress: contact?.streetAddress || "",
      city: contact?.city || "",
      state: contact?.state || "",
      zipCode: contact?.zipCode || "",
      category: (contact?.category as any) || "customer",
      isBusiness: contact?.isBusiness || false,
      businessName: contact?.businessName || "",
      notes: contact?.notes || "",
    },
  });

  const isBusiness = form.watch("isBusiness");

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-contact-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {contactCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="isBusiness"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center gap-2">
              <FormControl>
                <Checkbox 
                  checked={field.value} 
                  onCheckedChange={field.onChange}
                  data-testid="checkbox-is-business"
                />
              </FormControl>
              <FormLabel className="!mt-0">This is a business</FormLabel>
            </FormItem>
          )}
        />

        {isBusiness && (
          <FormField
            control={form.control}
            name="businessName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Business Name</FormLabel>
                <FormControl>
                  <Input placeholder="Company name" {...field} data-testid="input-business-name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Name</FormLabel>
                <FormControl>
                  <Input placeholder="First name" {...field} data-testid="input-first-name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last Name</FormLabel>
                <FormControl>
                  <Input placeholder="Last name" {...field} data-testid="input-last-name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <Input placeholder="(555) 555-5555" {...field} data-testid="input-phone" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input placeholder="email@example.com" {...field} data-testid="input-email" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="streetAddress"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Street Address</FormLabel>
              <FormControl>
                <Input placeholder="123 Main St" {...field} data-testid="input-street-address" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>City</FormLabel>
                <FormControl>
                  <Input placeholder="City" {...field} data-testid="input-city" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="state"
            render={({ field }) => (
              <FormItem>
                <FormLabel>State</FormLabel>
                <FormControl>
                  <Input placeholder="TX" {...field} data-testid="input-state" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="zipCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ZIP</FormLabel>
                <FormControl>
                  <Input placeholder="78201" {...field} data-testid="input-zip" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Additional notes about this contact..." 
                  {...field} 
                  data-testid="textarea-notes"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <DialogFooter>
          <Button type="submit" disabled={isPending} data-testid="button-save-contact">
            {isPending ? "Saving..." : contact ? "Update Contact" : "Create Contact"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

function ContactDetails({ contact }: { contact: Contact }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground text-xs">First Name</Label>
              <div className="font-medium">{contact.firstName}</div>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Last Name</Label>
              <div className="font-medium">{contact.lastName}</div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label className="text-muted-foreground text-xs">Phone</Label>
                <div className="font-medium">{formatPhoneNumber(contact.phone)}</div>
              </div>
            </div>
            {contact.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label className="text-muted-foreground text-xs">Email</Label>
                  <div className="font-medium">{contact.email}</div>
                </div>
              </div>
            )}
          </div>

          {(contact.streetAddress || contact.city) && (
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <Label className="text-muted-foreground text-xs">Address</Label>
                <div className="font-medium">
                  {contact.streetAddress && <div>{contact.streetAddress}</div>}
                  {(contact.city || contact.state || contact.zipCode) && (
                    <div>{[contact.city, contact.state, contact.zipCode].filter(Boolean).join(", ")}</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {contact.isBusiness && contact.businessName && (
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label className="text-muted-foreground text-xs">Business Name</Label>
                <div className="font-medium">{contact.businessName}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {contact.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{contact.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ContactJobs({ jobs, isLoading }: { jobs?: Job[]; isLoading: boolean }) {
  if (isLoading) {
    return <div className="text-center text-muted-foreground py-8">Loading jobs...</div>;
  }

  if (!jobs || jobs.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <Briefcase className="h-10 w-10 mx-auto mb-2 opacity-50" />
        <p>No jobs found for this contact</p>
      </div>
    );
  }

  const stageColors: Record<string, string> = {
    quote: "bg-yellow-500/10 text-yellow-600",
    scheduled: "bg-blue-500/10 text-blue-600",
    paid_completed: "bg-green-500/10 text-green-600",
    lost_opportunity: "bg-red-500/10 text-red-600",
  };

  return (
    <div className="space-y-3">
      {jobs.map((job) => (
        <Card key={job.id} className="hover-elevate cursor-pointer" data-testid={`job-card-${job.id}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{job.jobNumber}</div>
                <div className="text-sm text-muted-foreground">
                  {job.vehicles && (job.vehicles as any[]).length > 0 && (
                    <span>{(job.vehicles as any[])[0].vehicleYear} {(job.vehicles as any[])[0].vehicleMake} {(job.vehicles as any[])[0].vehicleModel}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={stageColors[job.pipelineStage || "quote"]} variant="secondary">
                  {(job.pipelineStage || "quote").replace("_", " ")}
                </Badge>
                <span className="font-medium">${(job as any).totalAmount?.toFixed(2) || "0.00"}</span>
              </div>
            </div>
            {job.installDate && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                <Calendar className="h-3 w-3" />
                {new Date(job.installDate).toLocaleDateString()}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ContactDocuments({ jobs, isLoading }: { jobs?: Job[]; isLoading: boolean }) {
  if (isLoading) {
    return <div className="text-center text-muted-foreground py-8">Loading documents...</div>;
  }

  const documents: { type: string; label: string; url: string; jobNumber: string; date: string }[] = [];

  if (jobs) {
    for (const job of jobs) {
      if (job.signatureImage) {
        documents.push({
          type: "signature",
          label: `Signature - ${job.jobNumber}`,
          url: job.signatureImage,
          jobNumber: job.jobNumber,
          date: job.createdAt || "",
        });
      }

      const photos = job.completionPhotos as Record<string, string> | undefined;
      if (photos) {
        if (photos.preInspection) {
          documents.push({
            type: "photo",
            label: `Pre-Inspection - ${job.jobNumber}`,
            url: photos.preInspection,
            jobNumber: job.jobNumber,
            date: job.createdAt || "",
          });
        }
        if (photos.vin) {
          documents.push({
            type: "photo",
            label: `VIN Photo - ${job.jobNumber}`,
            url: photos.vin,
            jobNumber: job.jobNumber,
            date: job.createdAt || "",
          });
        }
        if (photos.partInstalled) {
          documents.push({
            type: "photo",
            label: `Part Installed - ${job.jobNumber}`,
            url: photos.partInstalled,
            jobNumber: job.jobNumber,
            date: job.createdAt || "",
          });
        }
        if (photos.after) {
          documents.push({
            type: "photo",
            label: `After Photo - ${job.jobNumber}`,
            url: photos.after,
            jobNumber: job.jobNumber,
            date: job.createdAt || "",
          });
        }
      }
    }
  }

  if (documents.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
        <p>No documents found for this contact</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {documents.map((doc, index) => (
        <Card key={index} className="hover-elevate cursor-pointer overflow-hidden" data-testid={`document-${index}`}>
          <div className="aspect-video bg-muted relative">
            <img 
              src={doc.url} 
              alt={doc.label} 
              className="w-full h-full object-cover"
            />
            <div className="absolute top-2 right-2">
              <Badge variant="secondary" className="text-xs">
                {doc.type === "signature" ? "Signature" : "Photo"}
              </Badge>
            </div>
          </div>
          <CardContent className="p-3">
            <div className="text-sm font-medium truncate">{doc.label}</div>
            <div className="text-xs text-muted-foreground">
              {doc.date ? new Date(doc.date).toLocaleDateString() : ""}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
