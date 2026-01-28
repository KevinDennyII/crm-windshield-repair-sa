import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO, startOfWeek, endOfWeek } from "date-fns";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, RefreshCw, Clock, MapPin, User, Phone, Car, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Job } from "@shared/schema";

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  htmlLink?: string;
}

interface CalendarStatus {
  configured: boolean;
}

function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

function getTimeFromEvent(event: CalendarEvent): string {
  if (event.start.dateTime) {
    const date = parseISO(event.start.dateTime);
    return format(date, 'h:mm a');
  }
  return 'All day';
}

function getDateFromEvent(event: CalendarEvent): Date {
  if (event.start.dateTime) {
    return parseISO(event.start.dateTime);
  }
  if (event.start.date) {
    return parseISO(event.start.date);
  }
  return new Date();
}

export default function CalendarPage() {
  const { toast } = useToast();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const { data: status } = useQuery<CalendarStatus>({
    queryKey: ['/api/calendar/status'],
  });

  const { data: jobs, isLoading: jobsLoading } = useQuery<Job[]>({
    queryKey: ['/api/jobs'],
  });

  const { data: googleEvents, isLoading: eventsLoading, refetch: refetchEvents } = useQuery<CalendarEvent[]>({
    queryKey: ['/api/calendar/events', format(calendarStart, 'yyyy-MM-dd'), format(calendarEnd, 'yyyy-MM-dd')],
    queryFn: async () => {
      const start = calendarStart.toISOString();
      const end = calendarEnd.toISOString();
      const response = await fetch(`/api/calendar/events?start=${start}&end=${end}`);
      if (!response.ok) throw new Error('Failed to fetch events');
      return response.json();
    },
    enabled: status?.configured === true,
  });

  const scheduledJobs = useMemo(() => {
    if (!jobs) return [];
    return jobs.filter(job => 
      job.pipelineStage === 'scheduled' && job.installDate && job.installTime
    );
  }, [jobs]);

  const calendarDays = useMemo(() => {
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [calendarStart, calendarEnd]);

  const getEventsForDate = (date: Date) => {
    const events: { type: 'job' | 'google'; data: Job | CalendarEvent }[] = [];
    
    scheduledJobs.forEach(job => {
      if (job.installDate) {
        const jobDate = parseISO(job.installDate);
        if (isSameDay(jobDate, date)) {
          events.push({ type: 'job', data: job });
        }
      }
    });

    if (googleEvents) {
      googleEvents.forEach(event => {
        const eventDate = getDateFromEvent(event);
        if (isSameDay(eventDate, date)) {
          const isJobEvent = scheduledJobs.some(job => 
            job.googleCalendarEventId === event.id
          );
          if (!isJobEvent) {
            events.push({ type: 'google', data: event });
          }
        }
      });
    }

    return events;
  };

  const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  const syncJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      return apiRequest('POST', `/api/jobs/${jobId}/calendar`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      refetchEvents();
      toast({ title: "Calendar synced", description: "Job synced to Google Calendar" });
    },
    onError: (error: any) => {
      toast({ title: "Sync failed", description: error.message, variant: "destructive" });
    },
  });

  const handlePreviousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const handleToday = () => {
    setCurrentMonth(new Date());
    setSelectedDate(new Date());
  };

  const isLoading = jobsLoading || eventsLoading;

  return (
    <div className="h-full flex flex-col p-4 md:p-6 gap-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-calendar-title">
            <CalendarIcon className="h-6 w-6" />
            Calendar
          </h1>
          <p className="text-sm text-muted-foreground">
            Scheduled installations and appointments
          </p>
        </div>
        <div className="flex items-center gap-2">
          {status?.configured ? (
            <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
              Google Calendar Connected
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
              Google Calendar Not Connected
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchEvents()}
            disabled={isLoading}
            data-testid="button-refresh-calendar"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
        <Card className="lg:col-span-2 flex flex-col">
          <CardHeader className="flex-shrink-0 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                {format(currentMonth, 'MMMM yyyy')}
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handlePreviousMonth}
                  data-testid="button-prev-month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToday}
                  data-testid="button-today"
                >
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleNextMonth}
                  data-testid="button-next-month"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 pt-0">
            <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden h-full">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div
                  key={day}
                  className="bg-muted p-2 text-center text-xs font-medium text-muted-foreground"
                >
                  {day}
                </div>
              ))}
              {calendarDays.map((day, index) => {
                const events = getEventsForDate(day);
                const isToday = isSameDay(day, new Date());
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const isCurrentMonth = isSameMonth(day, currentMonth);

                return (
                  <button
                    key={index}
                    onClick={() => setSelectedDate(day)}
                    className={`
                      bg-card p-1 text-left min-h-[80px] transition-colors relative
                      ${!isCurrentMonth ? 'text-muted-foreground/50' : ''}
                      ${isSelected ? 'ring-2 ring-primary ring-inset' : ''}
                      ${isToday ? 'bg-primary/5' : ''}
                      hover:bg-muted/50
                    `}
                    data-testid={`calendar-day-${format(day, 'yyyy-MM-dd')}`}
                  >
                    <span
                      className={`
                        text-sm font-medium inline-flex items-center justify-center w-6 h-6 rounded-full
                        ${isToday ? 'bg-primary text-primary-foreground' : ''}
                      `}
                    >
                      {format(day, 'd')}
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {events.slice(0, 3).map((event, i) => (
                        <div
                          key={i}
                          className={`
                            text-xs px-1 py-0.5 rounded truncate
                            ${event.type === 'job' 
                              ? 'bg-primary/20 text-primary' 
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                            }
                          `}
                        >
                          {event.type === 'job' 
                            ? `${(event.data as Job).jobNumber} - ${(event.data as Job).lastName}`
                            : (event.data as CalendarEvent).summary?.slice(0, 15)
                          }
                        </div>
                      ))}
                      {events.length > 3 && (
                        <div className="text-xs text-muted-foreground px-1">
                          +{events.length - 3} more
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="flex-shrink-0 pb-2">
            <CardTitle className="text-lg">
              {selectedDate ? format(selectedDate, 'EEEE, MMMM d') : 'Select a day'}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 pt-0">
            <ScrollArea className="h-full">
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : selectedDateEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <CalendarIcon className="h-12 w-12 mb-2 opacity-50" />
                  <p className="text-sm">No appointments scheduled</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedDateEvents.map((event, index) => {
                    if (event.type === 'job') {
                      const job = event.data as Job;
                      return (
                        <Card key={index} className="bg-muted/30" data-testid={`event-job-${job.id}`}>
                          <CardContent className="p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <Badge variant="secondary" className="bg-primary/20 text-primary">
                                Job #{job.jobNumber}
                              </Badge>
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">
                                  {job.installTime}
                                </span>
                              </div>
                            </div>
                            {job.vehicles && job.vehicles.length > 0 && (
                              <div className="space-y-1">
                                {job.vehicles.map((vehicle, vIdx) => (
                                  <div key={vIdx}>
                                    <div className="flex items-center gap-1 text-sm">
                                      <Car className="h-3 w-3 text-muted-foreground" />
                                      <span className="font-medium">
                                        {vehicle.vehicleYear} {vehicle.vehicleMake} {vehicle.vehicleModel}
                                      </span>
                                    </div>
                                    {vehicle.parts && vehicle.parts.map((part, pIdx) => (
                                      <div key={pIdx} className="ml-4 text-xs text-muted-foreground">
                                        {part.glassType?.replace(/_/g, ' ')} - {part.glassPartNumber || 'No part#'}
                                      </div>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="flex items-center gap-1 text-sm">
                              <User className="h-3 w-3 text-muted-foreground" />
                              <span>{job.firstName} {job.lastName}</span>
                            </div>
                            <div className="flex items-center gap-1 text-sm">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              <span>{formatPhoneDisplay(job.phone)}</span>
                            </div>
                            {job.streetAddress && (
                              <div className="flex items-center gap-1 text-sm">
                                <MapPin className="h-3 w-3 text-muted-foreground" />
                                <span className="truncate">{job.streetAddress}, {job.city}</span>
                              </div>
                            )}
                            <div className="flex items-center justify-between pt-1">
                              <span className="text-sm font-medium text-primary">
                                ${job.totalDue.toLocaleString()}
                              </span>
                              {status?.configured && !job.googleCalendarEventId && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => syncJobMutation.mutate(job.id)}
                                  disabled={syncJobMutation.isPending}
                                  data-testid={`button-sync-job-${job.id}`}
                                >
                                  Sync to Calendar
                                </Button>
                              )}
                              {job.googleCalendarEventId && (
                                <Badge variant="outline" className="text-green-600">
                                  Synced
                                </Badge>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    } else {
                      const gcEvent = event.data as CalendarEvent;
                      return (
                        <Card key={index} className="bg-blue-50 dark:bg-blue-950/30" data-testid={`event-google-${gcEvent.id}`}>
                          <CardContent className="p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-sm truncate">
                                {gcEvent.summary}
                              </span>
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">
                                  {getTimeFromEvent(gcEvent)}
                                </span>
                              </div>
                            </div>
                            {gcEvent.location && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <MapPin className="h-3 w-3" />
                                <span className="truncate">{gcEvent.location}</span>
                              </div>
                            )}
                            {gcEvent.htmlLink && (
                              <a
                                href={gcEvent.htmlLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                              >
                                <ExternalLink className="h-3 w-3" />
                                View in Google Calendar
                              </a>
                            )}
                          </CardContent>
                        </Card>
                      );
                    }
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
