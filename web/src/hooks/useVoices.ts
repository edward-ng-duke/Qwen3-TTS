import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"

export const useVoices = () =>
  useQuery({ queryKey: ["voices"], queryFn: api.voices, staleTime: 60_000 })

export const useLanguages = () =>
  useQuery({ queryKey: ["languages"], queryFn: api.languages, staleTime: 60_000 })

export const useHealth = () =>
  useQuery({ queryKey: ["health"], queryFn: api.health, refetchInterval: 15_000 })
