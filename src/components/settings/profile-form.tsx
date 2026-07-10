"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { profileSchema, type ProfileInput } from "@/lib/validations/profile";
import { updateUserProfile, uploadAvatar, type ProfileData } from "@/lib/actions/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";

type ProfileFormProps = {
  initialData: ProfileData;
};

export function ProfileForm({ initialData }: ProfileFormProps) {
  const [avatarUrl, setAvatarUrl] = useState(initialData.avatarUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: initialData.name ?? "",
      email: initialData.email,
      phone: initialData.phone ?? "",
      companyName: initialData.companyName ?? "",
      companyRut: initialData.companyRut ?? "",
      companyAddress: initialData.companyAddress ?? "",
      language: initialData.language as "es" | "en",
      currency: initialData.currency as "CLP" | "USD",
      timezone: initialData.timezone as "America/Santiago" | "America/Lima",
    },
  });

  async function onSubmit(data: ProfileInput) {
    const result = await updateUserProfile(data);
    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success("Cambios guardados correctamente");
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.set("file", file);

    const result = await uploadAvatar(formData);
    if ("error" in result) {
      toast.error(result.error);
    } else {
      setAvatarUrl(result.url);
      toast.success("Avatar actualizado");
    }

    // Reset input so same file can be selected again
    e.target.value = "";
  }

  const initials = (initialData.name ?? initialData.email)
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Perfil de Usuario */}
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Perfil de Usuario</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              {avatarUrl && <AvatarImage src={avatarUrl} alt="Avatar" />}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                Cambiar Avatar
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre Completo</Label>
              <Input
                id="name"
                {...register("name")}
                placeholder="Juan Pérez"
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Correo Electrónico</Label>
              <Input
                id="email"
                type="email"
                {...register("email")}
                readOnly
                className="cursor-not-allowed opacity-60"
              />
              <p className="text-xs text-muted-foreground">
                Para cambiar tu email, contacta a soporte.
              </p>
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                {...register("phone")}
                placeholder="+56 9 1234 5678"
              />
              {errors.phone && (
                <p className="text-sm text-destructive">{errors.phone.message}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Empresa */}
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Empresa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="companyName">Nombre de la Empresa</Label>
              <Input
                id="companyName"
                {...register("companyName")}
                placeholder="Mi Empresa Ltda."
              />
              {errors.companyName && (
                <p className="text-sm text-destructive">{errors.companyName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="companyRut">RUT</Label>
              <Input
                id="companyRut"
                {...register("companyRut")}
                placeholder="12.345.678-9"
              />
              {errors.companyRut && (
                <p className="text-sm text-destructive">{errors.companyRut.message}</p>
              )}
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="companyAddress">Dirección</Label>
              <Input
                id="companyAddress"
                {...register("companyAddress")}
                placeholder="Av. Principal 123, Santiago"
              />
              {errors.companyAddress && (
                <p className="text-sm text-destructive">{errors.companyAddress.message}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preferencias de la Plataforma */}
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Preferencias de la Plataforma</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="language">Idioma</Label>
              <Select
                defaultValue={initialData.language}
                onValueChange={(value) =>
                  setValue("language", value as "es" | "en", { shouldDirty: true })
                }
              >
                <SelectTrigger id="language">
                  <SelectValue placeholder="Selecciona un idioma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="es">Español</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
              {errors.language && (
                <p className="text-sm text-destructive">{errors.language.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Moneda</Label>
              <Select
                defaultValue={initialData.currency}
                onValueChange={(value) =>
                  setValue("currency", value as "CLP" | "USD", { shouldDirty: true })
                }
              >
                <SelectTrigger id="currency">
                  <SelectValue placeholder="Selecciona una moneda" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CLP">CLP</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
              {errors.currency && (
                <p className="text-sm text-destructive">{errors.currency.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">Zona Horaria</Label>
              <Select
                defaultValue={initialData.timezone}
                onValueChange={(value) =>
                  setValue(
                    "timezone",
                    value as "America/Santiago" | "America/Lima",
                    { shouldDirty: true },
                  )
                }
              >
                <SelectTrigger id="timezone">
                  <SelectValue placeholder="Selecciona una zona" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="America/Santiago">Santiago</SelectItem>
                  <SelectItem value="America/Lima">Lima</SelectItem>
                </SelectContent>
              </Select>
              {errors.timezone && (
                <p className="text-sm text-destructive">{errors.timezone.message}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Guardando..." : "Guardar Cambios"}
        </Button>
      </div>
    </form>
  );
}
