import React, { useState, useEffect, useRef } from "react";
import { type Image, type Folder } from "@prisma/client";
import { trpc } from "../../utils/trpc";
import { AnimatePresence } from "framer-motion";
import {
  FaFolder,
  FaHome,
  FaEdit,
  FaTrash,
  FaTimes,
  FaCheck,
} from "react-icons/fa";
import ConfirmDeleteModal from "../modals/ConfirmDeleteModal";
import { useLocalStorageContext } from "../../context/LocalStorageContext";
import { useSession } from "next-auth/react";
import LoadingDots from "../loadingAssets/LoadingDots";

interface IFolders {
  selectedFolder: Folder | null;
  setSelectedFolder: React.Dispatch<React.SetStateAction<Folder | null>>;
  setImageBeingEdited: React.Dispatch<React.SetStateAction<Image | undefined>>;
  setSelectedImages: React.Dispatch<React.SetStateAction<string[]>>;
  folders: Folder[];
}

function Folders({
  selectedFolder,
  setSelectedFolder,
  setSelectedImages,
  folders,
}: IFolders) {
  const { data: session } = useSession();
  const utils = trpc.useContext();

  const [editingFolderData, setEditingFolderData] = useState<boolean>(false);
  const [temporaryFolderData, setTemporaryFolderData] = useState<Folder | null>(
    null
  );

  const [updatingHidePrivateImages, setUpdatingHidePrivateImages] =
    useState<boolean>(false);
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] =
    useState<boolean>(false);

  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTemporaryFolderData(selectedFolder); // maybe a problem?
  }, [selectedFolder]);

  const localStorageID = useLocalStorageContext();

  const { data: hidePrivateImages } =
    trpc.users.getHidePrivateImageStatus.useQuery(
      localStorageID?.value ?? session?.user?.id
    );

  const toggleHidePrivateImages =
    trpc.users.toggleHidePrivateImages.useMutation({
      onMutate: () => {
        utils.users.getHidePrivateImageStatus.cancel();
        const optimisticUpdate =
          utils.users.getHidePrivateImageStatus.getData();

        if (optimisticUpdate) {
          utils.users.getHidePrivateImageStatus.setData(optimisticUpdate);
        }
      },
      onSettled: () => {
        utils.users.getHidePrivateImageStatus.invalidate();
        setTimeout(() => setUpdatingHidePrivateImages(false), 400);
      },
    });

  const updateFolderData = trpc.folders.updateFolderData.useMutation({
    onMutate: () => {
      utils.folders.getUserFolders.cancel();
      const optimisticUpdate = utils.folders.getUserFolders.getData();

      if (optimisticUpdate) {
        utils.folders.getUserFolders.setData(optimisticUpdate);
      }
    },
    onSuccess() {
      setSelectedFolder(temporaryFolderData);
      setEditingFolderData(false);
    },
    onSettled: () => {
      utils.folders.getUserFolders.invalidate();
    },
  });

  return (
    <div className="flex flex-col justify-center gap-2 rounded-md bg-blue-500 p-2">
      {selectedFolder ? (
        <div className="flex flex-col items-center justify-start gap-4 sm:flex-row">
          <button
            className="secondaryBtn flex items-center justify-center gap-2"
            aria-label="Back to home"
            onClick={() => {
              setSelectedFolder(null);
              setSelectedImages([]);
              setEditingFolderData(false);
              titleRef.current?.blur();
            }}
          >
            <FaHome size={"1rem"} />
            Back to home
          </button>

          <div className="flex items-center justify-center gap-4">
            <div className="flex items-center justify-center gap-2">
              {editingFolderData ? (
                <div className="flex flex-col items-center justify-center gap-2 sm:flex-row">
                  <div className="flex items-center justify-center gap-2">
                    <FaFolder size={"1rem"} />
                    <input
                      ref={titleRef}
                      className="w-full rounded-md pl-2"
                      type="text"
                      placeholder="Title"
                      value={temporaryFolderData?.title ?? "Loading..."}
                      onChange={(e) => {
                        const newFolderData = { ...selectedFolder };
                        newFolderData.title = e.target.value;
                        setTemporaryFolderData(newFolderData);
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-center gap-2">
                    <button
                      className="secondaryBtn"
                      aria-label="Cancel"
                      onClick={() => {
                        const newFolderData = { ...selectedFolder };
                        newFolderData.title = selectedFolder.title;
                        setTemporaryFolderData(newFolderData);
                        setEditingFolderData(false);
                      }}
                    >
                      <FaTimes size={"1rem"} />
                    </button>
                    <button
                      className="secondaryBtn"
                      aria-label="Save"
                      onClick={() => {
                        // call update folder mutation here
                        if (temporaryFolderData) {
                          updateFolderData.mutate({
                            id: temporaryFolderData.id,
                            title: temporaryFolderData.title,
                            description: temporaryFolderData?.description,
                          });
                        }
                      }}
                    >
                      <FaCheck size={"1rem"} />
                    </button>
                  </div>

                  <button
                    className="dangerBtn"
                    aria-label="Delete"
                    onClick={() => setShowConfirmDeleteModal(true)}
                  >
                    <FaTrash size={"1rem"} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-4">
                  <FaFolder size={"1rem"} />

                  <div>{selectedFolder.title}</div>
                  <button
                    className="secondaryBtn"
                    aria-label="Edit"
                    onClick={() => {
                      setEditingFolderData(true);
                      setTimeout(() => titleRef.current?.focus(), 1);
                    }}
                  >
                    <FaEdit size={"1rem"} />
                  </button>

                  <button
                    className="dangerBtn"
                    aria-label="Delete"
                    onClick={() => setShowConfirmDeleteModal(true)}
                  >
                    <FaTrash size={"1rem"} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="pl-2 text-xl">
            {folders.length > 0 ? "Folders" : "No folders created yet."}
          </div>
          <div className="flex flex-wrap items-center justify-start gap-4 ">
            {folders.map((folder) => {
              return (
                <button
                  key={folder.id}
                  className="secondaryBtn flex items-center justify-center gap-2"
                  aria-label="open folder"
                  onClick={() => {
                    setSelectedFolder(folder);
                    setSelectedImages([]);
                  }}
                >
                  <FaFolder size={"1rem"} />
                  {folder.title}
                </button>
              );
            })}
          </div>
        </>
      )}
      <div className="flex items-center justify-center">
        <div className="flex max-w-fit items-center justify-center gap-2 rounded-md bg-blue-700/80 p-2">
          {updatingHidePrivateImages ? (
            <LoadingDots height={32} width={32} radius={12} />
          ) : (
            <input
              className="h-[1.25rem] w-[1.25rem] cursor-pointer"
              aria-label="select image toggle"
              type="checkbox"
              checked={hidePrivateImages ?? true}
              onChange={() => {
                setUpdatingHidePrivateImages(true);
                toggleHidePrivateImages.mutate({
                  userID: localStorageID?.value ?? session?.user?.id,
                  newValue: !hidePrivateImages,
                });
              }}
            />
          )}
          <div className="text-sm">Hide private images</div>
        </div>
      </div>

      <AnimatePresence
        initial={false}
        mode={"wait"}
        onExitComplete={() => null}
      >
        {showConfirmDeleteModal && selectedFolder && (
          <ConfirmDeleteModal
            type={"folder"}
            setShowConfirmDeleteModal={setShowConfirmDeleteModal}
            idsToDelete={[selectedFolder.id]}
            afterFolderDeletionCallback={setSelectedFolder}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default Folders;
