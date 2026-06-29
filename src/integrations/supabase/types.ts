export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action_type: string
          actor_person_id: string | null
          created_at: string
          description: string | null
          entity_id: string
          entity_type: string
          id: string
          metadata: Json
          title: string
          user_id: string
        }
        Insert: {
          action_type: string
          actor_person_id?: string | null
          created_at?: string
          description?: string | null
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json
          title: string
          user_id: string
        }
        Update: {
          action_type?: string
          actor_person_id?: string | null
          created_at?: string
          description?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      calendar_feed_tokens: {
        Row: {
          created_at: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      contexts: {
        Row: {
          created_at: string
          id: string
          name: string
          position: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id: string
          name: string
          position?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: number
          user_id?: string
        }
        Relationships: []
      }
      inbox_items: {
        Row: {
          assigned_person_id: string | null
          captured_on: string
          context: string
          created_at: string
          due: string | null
          energy: string
          id: string
          minutes: number
          notes: string
          position: number
          priority: string
          project: string
          someday_category: string
          tags: string[]
          title: string
          updated_at: string
          user_id: string
          waiting_follow_up: string | null
          waiting_person: string
        }
        Insert: {
          assigned_person_id?: string | null
          captured_on?: string
          context?: string
          created_at?: string
          due?: string | null
          energy?: string
          id: string
          minutes?: number
          notes?: string
          position?: number
          priority?: string
          project?: string
          someday_category?: string
          tags?: string[]
          title: string
          updated_at?: string
          user_id: string
          waiting_follow_up?: string | null
          waiting_person?: string
        }
        Update: {
          assigned_person_id?: string | null
          captured_on?: string
          context?: string
          created_at?: string
          due?: string | null
          energy?: string
          id?: string
          minutes?: number
          notes?: string
          position?: number
          priority?: string
          project?: string
          someday_category?: string
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
          waiting_follow_up?: string | null
          waiting_person?: string
        }
        Relationships: []
      }
      meeting_actions: {
        Row: {
          assigned_person_id: string | null
          assignee: string | null
          created_at: string | null
          due: string | null
          id: string
          linked_project: string | null
          meeting_id: string
          status: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          assigned_person_id?: string | null
          assignee?: string | null
          created_at?: string | null
          due?: string | null
          id: string
          linked_project?: string | null
          meeting_id: string
          status?: string | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          assigned_person_id?: string | null
          assignee?: string | null
          created_at?: string | null
          due?: string | null
          id?: string
          linked_project?: string | null
          meeting_id?: string
          status?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_actions_assigned_person_id_fkey"
            columns: ["assigned_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_actions_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_people: {
        Row: {
          created_at: string
          id: string
          meeting_id: string
          person_id: string
          role: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          meeting_id: string
          person_id: string
          role?: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          meeting_id?: string
          person_id?: string
          role?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_people_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_people_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_people_group_folders: {
        Row: {
          created_at: string
          folder_id: string
          id: string
          meeting_id: string
        }
        Insert: {
          created_at?: string
          folder_id: string
          id?: string
          meeting_id: string
        }
        Update: {
          created_at?: string
          folder_id?: string
          id?: string
          meeting_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_people_group_folders_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "people_group_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_people_group_folders_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_people_groups: {
        Row: {
          created_at: string
          group_id: string
          id: string
          meeting_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          meeting_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          meeting_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_people_groups_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "people_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_people_groups_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          agenda: string | null
          attendees: string[] | null
          chairperson_id: string | null
          created_at: string | null
          google_meet_url: string | null
          id: string
          location: string | null
          meeting_date: string | null
          meeting_time: string | null
          minute_taker_id: string | null
          notes: string | null
          status: string | null
          title: string
          type: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          agenda?: string | null
          attendees?: string[] | null
          chairperson_id?: string | null
          created_at?: string | null
          google_meet_url?: string | null
          id: string
          location?: string | null
          meeting_date?: string | null
          meeting_time?: string | null
          minute_taker_id?: string | null
          notes?: string | null
          status?: string | null
          title: string
          type?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          agenda?: string | null
          attendees?: string[] | null
          chairperson_id?: string | null
          created_at?: string | null
          google_meet_url?: string | null
          id?: string
          location?: string | null
          meeting_date?: string | null
          meeting_time?: string | null
          minute_taker_id?: string | null
          notes?: string | null
          status?: string | null
          title?: string
          type?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_chairperson_id_fkey"
            columns: ["chairperson_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_minute_taker_id_fkey"
            columns: ["minute_taker_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_person_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          message: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          actor_person_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message?: string | null
          read_at?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          actor_person_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      people: {
        Row: {
          auth_user_id: string | null
          avatar_url: string | null
          created_at: string | null
          display_name: string
          email: string | null
          first_name: string
          gender: string | null
          id: string
          last_name: string | null
          membership_status: string | null
          notes: string | null
          phone_number: string | null
          updated_at: string | null
          user_id: string
          whatsapp_enabled: boolean | null
          workspace_id: string | null
        }
        Insert: {
          auth_user_id?: string | null
          avatar_url?: string | null
          created_at?: string | null
          display_name: string
          email?: string | null
          first_name: string
          gender?: string | null
          id?: string
          last_name?: string | null
          membership_status?: string | null
          notes?: string | null
          phone_number?: string | null
          updated_at?: string | null
          user_id: string
          whatsapp_enabled?: boolean | null
          workspace_id?: string | null
        }
        Update: {
          auth_user_id?: string | null
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string
          email?: string | null
          first_name?: string
          gender?: string | null
          id?: string
          last_name?: string | null
          membership_status?: string | null
          notes?: string | null
          phone_number?: string | null
          updated_at?: string | null
          user_id?: string
          whatsapp_enabled?: boolean | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "people_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      people_group_folders: {
        Row: {
          created_at: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      people_group_members: {
        Row: {
          created_at: string | null
          group_id: string
          id: string
          person_id: string
          role: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          group_id: string
          id?: string
          person_id: string
          role?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          group_id?: string
          id?: string
          person_id?: string
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "people_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_group_members_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      people_groups: {
        Row: {
          created_at: string | null
          description: string | null
          folder_id: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          folder_id?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          folder_id?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_groups_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "people_group_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      project_collaborators: {
        Row: {
          created_at: string | null
          id: string
          person_id: string
          project_id: string
          role: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          person_id: string
          project_id: string
          role?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          person_id?: string
          project_id?: string
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_collaborators_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_collaborators_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_sections: {
        Row: {
          created_at: string
          description: string
          id: string
          leader_person_id: string | null
          name: string
          project_id: string
          sort_order: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          leader_person_id?: string | null
          name: string
          project_id: string
          sort_order?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          leader_person_id?: string | null
          name?: string
          project_id?: string
          sort_order?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_sections_leader_person_id_fkey"
            columns: ["leader_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_sections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          area: string
          calendar_event_id: string | null
          created_at: string
          due_date: string | null
          event_end_at: string | null
          event_start_at: string | null
          id: string
          is_event: boolean
          name: string
          next_action: string
          notes: string
          open_tasks: number
          owner_person_id: string | null
          position: number
          progress: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          area?: string
          calendar_event_id?: string | null
          created_at?: string
          due_date?: string | null
          event_end_at?: string | null
          event_start_at?: string | null
          id?: string
          is_event?: boolean
          name: string
          next_action?: string
          notes?: string
          open_tasks?: number
          owner_person_id?: string | null
          position?: number
          progress?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          area?: string
          calendar_event_id?: string | null
          created_at?: string
          due_date?: string | null
          event_end_at?: string | null
          event_start_at?: string | null
          id?: string
          is_event?: boolean
          name?: string
          next_action?: string
          notes?: string
          open_tasks?: number
          owner_person_id?: string | null
          position?: number
          progress?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recurring_items: {
        Row: {
          context: string
          created_at: string
          day: string
          done: boolean
          id: string
          position: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          context?: string
          created_at?: string
          day?: string
          done?: boolean
          id: string
          position?: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          context?: string
          created_at?: string
          day?: string
          done?: boolean
          id?: string
          position?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      review_items: {
        Row: {
          created_at: string
          done: boolean
          id: string
          position: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          id: string
          position?: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          done?: boolean
          id?: string
          position?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      service_instances: {
        Row: {
          created_at: string
          id: string
          location: string | null
          notes: string | null
          service_date: string
          service_type_id: string
          start_time: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          location?: string | null
          notes?: string | null
          service_date: string
          service_type_id: string
          start_time?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          location?: string | null
          notes?: string | null
          service_date?: string
          service_type_id?: string
          start_time?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_instances_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order_items: {
        Row: {
          created_at: string
          details: string | null
          duration_minutes: number | null
          id: string
          item_type: string
          service_id: string
          sort_order: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          duration_minutes?: number | null
          id?: string
          item_type?: string
          service_id: string
          sort_order?: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          details?: string | null
          duration_minutes?: number | null
          id?: string
          item_type?: string
          service_id?: string
          sort_order?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_order_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "service_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order_template_items: {
        Row: {
          created_at: string
          details: string | null
          duration_minutes: number | null
          id: string
          item_type: string
          sort_order: number
          template_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          duration_minutes?: number | null
          id?: string
          item_type?: string
          sort_order?: number
          template_id: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          details?: string | null
          duration_minutes?: number | null
          id?: string
          item_type?: string
          sort_order?: number
          template_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_order_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "service_order_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          service_type_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          service_type_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          service_type_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_order_templates_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      service_team_assignments: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          person_id: string | null
          person_name: string
          role_name: string
          service_id: string
          sort_order: number
          team_id: string | null
          team_member_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          person_id?: string | null
          person_name: string
          role_name: string
          service_id: string
          sort_order?: number
          team_id?: string | null
          team_member_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          person_id?: string | null
          person_name?: string
          role_name?: string
          service_id?: string
          sort_order?: number
          team_id?: string | null
          team_member_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_team_assignments_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_team_assignments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "service_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_team_assignments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "service_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_team_assignments_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "service_team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      service_team_members: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          person_id: string | null
          person_name: string
          phone_number: string | null
          role_name: string | null
          team_id: string
          updated_at: string
          user_id: string
          whatsapp_enabled: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          person_id?: string | null
          person_name: string
          phone_number?: string | null
          role_name?: string | null
          team_id: string
          updated_at?: string
          user_id: string
          whatsapp_enabled?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          person_id?: string | null
          person_name?: string
          phone_number?: string | null
          role_name?: string | null
          team_id?: string
          updated_at?: string
          user_id?: string
          whatsapp_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "service_team_members_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "service_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      service_team_role_requirements: {
        Row: {
          created_at: string
          id: string
          required_count: number
          role_name: string
          service_type_id: string
          team_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          required_count?: number
          role_name: string
          service_type_id: string
          team_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          required_count?: number
          role_name?: string
          service_type_id?: string
          team_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_team_role_requirements_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_team_role_requirements_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "service_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      service_team_roles: {
        Row: {
          created_at: string
          id: string
          role_name: string
          sort_order: number
          team_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role_name: string
          sort_order?: number
          team_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role_name?: string
          sort_order?: number
          team_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_team_roles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "service_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      service_teams: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
          whatsapp_group_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
          whatsapp_group_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
          whatsapp_group_url?: string | null
        }
        Relationships: []
      }
      service_type_teams: {
        Row: {
          created_at: string
          id: string
          service_type_id: string
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          service_type_id: string
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          service_type_id?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_type_teams_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_type_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "service_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      service_types: {
        Row: {
          created_at: string
          default_duration_minutes: number | null
          default_start_time: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_duration_minutes?: number | null
          default_start_time?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_duration_minutes?: number | null
          default_start_time?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      someday_items: {
        Row: {
          category: string
          cover_image_url: string
          created_at: string
          created_on: string
          id: string
          notes: string
          position: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          cover_image_url?: string
          created_at?: string
          created_on?: string
          id: string
          notes?: string
          position?: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          cover_image_url?: string
          created_at?: string
          created_on?: string
          id?: string
          notes?: string
          position?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recurring_task_templates: {
        Row: {
          assigned_person_id: string | null
          context: string
          created_at: string
          creation_mode: string
          description: string
          end_after_occurrences: number | null
          end_condition: string
          end_date: string | null
          energy: string
          first_due_date: string
          frequency: string
          generated_count: number
          id: string
          interval: number
          last_generated_task_id: string | null
          minutes: number
          next_due_date: string | null
          priority: string
          project: string
          project_id: string | null
          status: string
          tags: string[]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_person_id?: string | null
          context?: string
          created_at?: string
          creation_mode?: string
          description?: string
          end_after_occurrences?: number | null
          end_condition?: string
          end_date?: string | null
          energy?: string
          first_due_date: string
          frequency?: string
          generated_count?: number
          id?: string
          interval?: number
          last_generated_task_id?: string | null
          minutes?: number
          next_due_date?: string | null
          priority?: string
          project?: string
          project_id?: string | null
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_person_id?: string | null
          context?: string
          created_at?: string
          creation_mode?: string
          description?: string
          end_after_occurrences?: number | null
          end_condition?: string
          end_date?: string | null
          energy?: string
          first_due_date?: string
          frequency?: string
          generated_count?: number
          id?: string
          interval?: number
          last_generated_task_id?: string | null
          minutes?: number
          next_due_date?: string | null
          priority?: string
          project?: string
          project_id?: string | null
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_task_templates_last_generated_task_id_fkey"
            columns: ["last_generated_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_task_templates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_person_id: string | null
          complete: boolean
          completed_at: string | null
          context: string
          created_at: string
          due: string | null
          energy: string
          id: string
          location: string
          minutes: number
          notes: string
          person: string
          position: number
          priority: string
          project: string
          project_id: string | null
          recurring_occurrence_number: number | null
          recurring_template_id: string | null
          section_id: string | null
          start_time: string | null
          tags: string[]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_person_id?: string | null
          complete?: boolean
          completed_at?: string | null
          context?: string
          created_at?: string
          due?: string | null
          energy?: string
          id: string
          location?: string
          minutes?: number
          notes?: string
          person?: string
          position?: number
          priority?: string
          project?: string
          project_id?: string | null
          recurring_occurrence_number?: number | null
          recurring_template_id?: string | null
          section_id?: string | null
          start_time?: string | null
          tags?: string[]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_person_id?: string | null
          complete?: boolean
          completed_at?: string | null
          context?: string
          created_at?: string
          due?: string | null
          energy?: string
          id?: string
          location?: string
          minutes?: number
          notes?: string
          person?: string
          position?: number
          priority?: string
          project?: string
          project_id?: string | null
          recurring_occurrence_number?: number | null
          recurring_template_id?: string | null
          section_id?: string | null
          start_time?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_recurring_template_id_fkey"
            columns: ["recurring_template_id"]
            isOneToOne: false
            referencedRelation: "recurring_task_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "project_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      training_assignments: {
        Row: {
          assigned_by: string
          completed_at: string | null
          course_id: string
          created_at: string
          due_date: string | null
          id: string
          person_id: string
          progress: number
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assigned_by: string
          completed_at?: string | null
          course_id: string
          created_at?: string
          due_date?: string | null
          id?: string
          person_id: string
          progress?: number
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          assigned_by?: string
          completed_at?: string | null
          course_id?: string
          created_at?: string
          due_date?: string | null
          id?: string
          person_id?: string
          progress?: number
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "training_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_assignments_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_assignments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      training_courses: {
        Row: {
          category: string
          cover_image_url: string | null
          created_at: string
          description: string
          estimated_minutes: number
          id: string
          modules: string[]
          section_id: string | null
          status: string
          suggested_audience: string
          title: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          category?: string
          cover_image_url?: string | null
          created_at?: string
          description?: string
          estimated_minutes?: number
          id?: string
          modules?: string[]
          section_id?: string | null
          status?: string
          suggested_audience?: string
          title: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          category?: string
          cover_image_url?: string | null
          created_at?: string
          description?: string
          estimated_minutes?: number
          id?: string
          modules?: string[]
          section_id?: string | null
          status?: string
          suggested_audience?: string
          title?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_courses_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_courses_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "training_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      training_sections: {
        Row: {
          created_at: string
          description: string
          id: string
          name: string
          position: number
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          name: string
          position?: number
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          name?: string
          position?: number
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_sections_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          active_view: string
          review_notes: string
          selected_context: string | null
          selection: Json | null
          settings: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          active_view?: string
          review_notes?: string
          selected_context?: string | null
          selection?: Json | null
          settings?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          active_view?: string
          review_notes?: string
          selected_context?: string | null
          selection?: Json | null
          settings?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      waiting_items: {
        Row: {
          created_at: string
          date_added: string
          follow_up: string | null
          follow_up_date: string | null
          id: string
          item: string
          notes: string
          person: string
          position: number
          project: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date_added?: string
          follow_up?: string | null
          follow_up_date?: string | null
          id: string
          item: string
          notes?: string
          person: string
          position?: number
          project?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date_added?: string
          follow_up?: string | null
          follow_up_date?: string | null
          id?: string
          item?: string
          notes?: string
          person?: string
          position?: number
          project?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      workspace_group_leaders: {
        Row: {
          created_at: string
          group_id: string
          id: string
          workspace_id: string
          workspace_member_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          workspace_id: string
          workspace_member_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          workspace_id?: string
          workspace_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_group_leaders_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "people_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_group_leaders_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_group_leaders_workspace_member_id_fkey"
            columns: ["workspace_member_id"]
            isOneToOne: false
            referencedRelation: "workspace_members"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          auth_user_id: string
          created_at: string
          id: string
          person_id: string | null
          role: string
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          id?: string
          person_id?: string | null
          role?: string
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          id?: string
          person_id?: string | null
          role?: string
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          join_code: string
          join_phrase_hash: string | null
          name: string
          owner_user_id: string
          release_mode: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          join_code: string
          join_phrase_hash?: string | null
          name: string
          owner_user_id: string
          release_mode?: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          join_code?: string
          join_phrase_hash?: string | null
          name?: string
          owner_user_id?: string
          release_mode?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      actsix_create_notification_for_person: {
        Args: {
          actor_person_id: string
          notification_entity_id?: string
          notification_entity_type?: string
          notification_message?: string
          notification_title: string
          notification_type?: string
          recipient_person_id: string
        }
        Returns: undefined
      }
      actsix_create_notification_for_user: {
        Args: {
          actor_person_id: string
          notification_entity_id?: string
          notification_entity_type?: string
          notification_message?: string
          notification_title: string
          notification_type?: string
          recipient_user_id: string
        }
        Returns: undefined
      }
      actsix_notify_project_participants: {
        Args: {
          actor_person_id: string
          notification_message: string
          notification_title: string
          notification_type?: string
          target_project_id: string
        }
        Returns: undefined
      }
      add_meeting_folder_source: {
        Args: { p_folder_id: string; p_meeting_id: string }
        Returns: undefined
      }
      add_meeting_group_source: {
        Args: { p_group_id: string; p_meeting_id: string }
        Returns: undefined
      }
      add_meeting_individual_person: {
        Args: { p_meeting_id: string; p_person_id: string }
        Returns: undefined
      }
      can_access_project: {
        Args: { target_project_id: string }
        Returns: boolean
      }
      can_current_user_edit_person: {
        Args: { target_person_id: string }
        Returns: boolean
      }
      create_notification_for_person:
        | {
            Args: {
              p_entity_id?: string
              p_entity_type?: string
              p_message?: string
              p_person_id: string
              p_title: string
              p_type?: string
            }
            Returns: string
          }
        | {
            Args: {
              actor_person_id: string
              notification_entity_id?: string
              notification_entity_type?: string
              notification_message?: string
              notification_title: string
              notification_type?: string
              recipient_person_id: string
            }
            Returns: undefined
          }
      create_notification_for_user: {
        Args: {
          actor_person_id: string
          notification_entity_id?: string
          notification_entity_type?: string
          notification_message?: string
          notification_title: string
          notification_type?: string
          recipient_user_id: string
        }
        Returns: undefined
      }
      create_person_for_workspace_member: {
        Args: { p_workspace_member_id: string }
        Returns: string
      }
      create_workspace_for_current_user: {
        Args: {
          workspace_join_code: string
          workspace_join_phrase: string
          workspace_name: string
        }
        Returns: string
      }
      crypt: { Args: { password: string; salt: string }; Returns: string }
      current_user_can_access_meeting: {
        Args: { p_meeting_id: string }
        Returns: boolean
      }
      current_user_is_workspace_admin: { Args: never; Returns: boolean }
      current_workspace_role: {
        Args: { target_workspace_id: string }
        Returns: string
      }
      ensure_current_workspace_person: {
        Args: never
        Returns: {
          auth_user_id: string | null
          avatar_url: string | null
          created_at: string | null
          display_name: string
          email: string | null
          first_name: string
          gender: string | null
          id: string
          last_name: string | null
          membership_status: string | null
          notes: string | null
          phone_number: string | null
          updated_at: string | null
          user_id: string
          whatsapp_enabled: boolean | null
          workspace_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "people"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      gen_salt: { Args: { salt_type: string }; Returns: string }
      get_current_workspace_id: { Args: never; Returns: string }
      get_current_workspace_invite_details: {
        Args: never
        Returns: {
          join_code: string
          workspace_id: string
          workspace_name: string
        }[]
      }
      get_meeting_people_scope: {
        Args: { p_meeting_id: string }
        Returns: {
          display_name: string
          email: string
          id: string
          person_id: string
          row_kind: string
          source_id: string
          source_name: string
          status: string
        }[]
      }
      get_visible_project_for_current_user: {
        Args: { target_project_id: string }
        Returns: {
          area: string
          created_at: string
          id: string
          name: string
          next_action: string
          notes: string
          open_tasks: number
          position: number
          progress: number
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "projects"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_visible_projects_for_current_user: {
        Args: { target_workspace_id: string }
        Returns: {
          area: string
          created_at: string
          id: string
          name: string
          next_action: string
          notes: string
          open_tasks: number
          position: number
          progress: number
          status: string
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "projects"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_workspace_members_for_current_user: {
        Args: { target_workspace_id: string }
        Returns: {
          auth_user_id: string
          created_at: string
          id: string
          person_email: string
          person_id: string
          person_name: string
          role: string
          status: string
          workspace_id: string
        }[]
      }
      get_workspace_people_links: {
        Args: never
        Returns: {
          member_email: string
          member_role: string
          member_user_id: string
          person_display_name: string
          person_email: string
          person_id: string
          workspace_id: string
          workspace_member_id: string
        }[]
      }
      join_workspace_by_code: {
        Args: { workspace_join_code: string; workspace_join_phrase: string }
        Returns: string
      }
      leave_current_workspace: {
        Args: { target_workspace_id: string }
        Returns: undefined
      }
      link_workspace_member_to_person: {
        Args: { p_person_id: string; p_workspace_member_id: string }
        Returns: undefined
      }
      remove_meeting_person: {
        Args: { p_meeting_id: string; p_person_id: string }
        Returns: undefined
      }
      sync_alpha_workspace_people_directory: { Args: never; Returns: undefined }
      sync_meeting_people_from_sources: {
        Args: { p_meeting_id: string }
        Returns: undefined
      }
      update_meeting_person_status: {
        Args: { p_meeting_id: string; p_person_id: string; p_status: string }
        Returns: undefined
      }
      update_workspace_join_phrase: {
        Args: { new_join_phrase: string; target_workspace_id: string }
        Returns: undefined
      }
      update_workspace_member_role: {
        Args: { next_role: string; target_member_id: string }
        Returns: undefined
      }
      update_workspace_person_profile: {
        Args: {
          next_email: string
          next_first_name: string
          next_gender: string
          next_last_name: string
          next_membership_status: string
          next_notes: string
          next_phone_number: string
          target_person_id: string
        }
        Returns: {
          auth_user_id: string | null
          avatar_url: string | null
          created_at: string | null
          display_name: string
          email: string | null
          first_name: string
          gender: string | null
          id: string
          last_name: string | null
          membership_status: string | null
          notes: string | null
          phone_number: string | null
          updated_at: string | null
          user_id: string
          whatsapp_enabled: boolean | null
          workspace_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "people"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
