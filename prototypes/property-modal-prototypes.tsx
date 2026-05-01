"use client";

import { useState } from "react";
import {
  PropertyModalMinimal,
  PropertyModalMinimalTrigger,
  PropertyModalModern,
  PropertyModalModernTrigger,
  PropertyModalLuxury,
  PropertyModalLuxuryTrigger,
  PropertyModalEditorial,
  PropertyModalEditorialTrigger,
  PropertyModalPlayful,
  PropertyModalPlayfulTrigger,
} from "@/prototypes/property-modal-index";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const usedColors = ["#3B82F6", "#10B981"];

const handleSubmit = async (data: any) => {
  console.log("Property created:", data);
  await new Promise((resolve) => setTimeout(resolve, 1000));
};

export function PropertyModalShowcase() {
  const [minimalOpen, setMinimalOpen] = useState(false);
  const [modernOpen, setModernOpen] = useState(false);
  const [luxuryOpen, setLuxuryOpen] = useState(false);
  const [editorialOpen, setEditorialOpen] = useState(false);
  const [playfulOpen, setPlayfulOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Property Modal Prototypes</h1>
          <p className="text-muted-foreground text-lg">
            5 variantes de modales para crear propiedades
          </p>
        </div>

        <Tabs defaultValue="minimal" className="w-full">
          <TabsList className="w-full justify-start mb-8 bg-muted p-1 rounded-lg inline-flex gap-1">
            <TabsTrigger value="minimal" className="px-4 py-1.5 text-sm font-medium rounded-md data-active:bg-background data-active:shadow-sm">Minimal</TabsTrigger>
            <TabsTrigger value="modern" className="px-4 py-1.5 text-sm font-medium rounded-md data-active:bg-background data-active:shadow-sm">Modern</TabsTrigger>
            <TabsTrigger value="luxury" className="px-4 py-1.5 text-sm font-medium rounded-md data-active:bg-background data-active:shadow-sm">Luxury</TabsTrigger>
            <TabsTrigger value="editorial" className="px-4 py-1.5 text-sm font-medium rounded-md data-active:bg-background data-active:shadow-sm">Editorial</TabsTrigger>
            <TabsTrigger value="playful" className="px-4 py-1.5 text-sm font-medium rounded-md data-active:bg-background data-active:shadow-sm">Playful</TabsTrigger>
          </TabsList>

          <TabsContent value="minimal" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Modal Minimal</CardTitle>
                <CardDescription>Diseño limpio y simple con ícono decorativo</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center py-8">
                <PropertyModalMinimalTrigger onClick={() => setMinimalOpen(true)} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="modern" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Modal Modern</CardTitle>
                <CardDescription>Glassmorphism con gradientes y blur sutil</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center py-8">
                <PropertyModalModernTrigger onClick={() => setModernOpen(true)} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="luxury" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Modal Luxury</CardTitle>
                <CardDescription>Tipografía serif con detalles elegantes</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center py-8">
                <PropertyModalLuxuryTrigger onClick={() => setLuxuryOpen(true)} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="editorial" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Modal Editorial</CardTitle>
                <CardDescription>Diseño editorial con barra lateral y progreso</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center py-8">
                <PropertyModalEditorialTrigger onClick={() => setEditorialOpen(true)} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="playful" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Modal Playful</CardTitle>
                <CardDescription>Diseño divertido con bordes redondeados y estrellas</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center py-8">
                <PropertyModalPlayfulTrigger onClick={() => setPlayfulOpen(true)} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <PropertyModalMinimal open={minimalOpen} onOpenChange={setMinimalOpen} onSubmit={handleSubmit} usedColors={usedColors} />
      <PropertyModalModern open={modernOpen} onOpenChange={setModernOpen} onSubmit={handleSubmit} usedColors={usedColors} />
      <PropertyModalLuxury open={luxuryOpen} onOpenChange={setLuxuryOpen} onSubmit={handleSubmit} usedColors={usedColors} />
      <PropertyModalEditorial open={editorialOpen} onOpenChange={setEditorialOpen} onSubmit={handleSubmit} usedColors={usedColors} />
      <PropertyModalPlayful open={playfulOpen} onOpenChange={setPlayfulOpen} onSubmit={handleSubmit} usedColors={usedColors} />
    </div>
  );
}