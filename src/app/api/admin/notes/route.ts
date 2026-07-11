import { NextResponse } from "next/server";
import { getSuperAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export async function GET(request: Request) {
  try {
    if (!(await getSuperAdminSession())) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const ownerId = searchParams.get("ownerId");

    if (!ownerId) {
      return NextResponse.json({ error: "ownerId es requerido" }, { status: 400 });
    }

    const notes = await prisma.adminNote.findMany({
      where: { ownerId },
      include: {
        admin: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(notes);
  } catch (error) {
    console.error("Error fetching notes:", error);
    return NextResponse.json({ error: "Error al obtener notas" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSuperAdminSession();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const data = await request.json();

    if (!data.ownerId || !data.content) {
      return NextResponse.json({ error: "ownerId y content son requeridos" }, { status: 400 });
    }

    const ownerExists = await prisma.userProfile.findUnique({
      where: { id: data.ownerId },
    });

    if (!ownerExists) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const note = await prisma.adminNote.create({
      data: {
        adminId: session.userId,
        ownerId: data.ownerId,
        content: data.content,
      },
      include: {
        admin: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json(note);
  } catch (error) {
    console.error("Error creating note:", error);
    return NextResponse.json({ error: "Error al crear nota" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    if (!(await getSuperAdminSession())) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const noteId = searchParams.get("noteId");

    if (!noteId) {
      return NextResponse.json({ error: "noteId es requerido" }, { status: 400 });
    }

    await prisma.adminNote.delete({
      where: { id: noteId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting note:", error);
    return NextResponse.json({ error: "Error al eliminar nota" }, { status: 500 });
  }
}